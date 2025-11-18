const nodemailer = require("nodemailer");
const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const prisma = new PrismaClient();
const JWT_SECRET = process.env.JWT_SECRET || 'fallback-secret-key-change-in-production';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '24h';

// Store for tracking OTP resend cooldown
global.resendCooldown = global.resendCooldown || {};

const requestOTP = async (req, res) => {
  const { email, isSignup = true } = req.body;

  if (!email) {
    return res.status(400).json({ error: "Email is required." });
  }

  // Validate email format
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return res.status(400).json({ error: "Invalid email format" });
  }

  // Check resend cooldown (1 minute)
  global.resendCooldown = global.resendCooldown || {};
  const now = Date.now();
  const lastSent = global.resendCooldown[email];
  
  if (lastSent && now - lastSent < 60000) {
    const remainingTime = Math.ceil((60000 - (now - lastSent)) / 1000);
    return res.status(429).json({ 
      error: `Please wait ${remainingTime} seconds before requesting another OTP.`,
      remainingTime 
    });
  }

  try {
    const existingUser = await prisma.user.findUnique({ where: { email } });
    
    if (isSignup) {
      // For signup, check if user already exists
      if (existingUser) {
        return res.status(400).json({ error: "User with this email already exists." });
      }
    } else {
      // For forgot password, check if user exists
      if (!existingUser) {
        return res.status(404).json({ error: "No account found with this email address." });
      }
    }

    const otp = Math.floor(100000 + Math.random() * 900000).toString();

    // Send OTP via email
    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.EMAIL,
        pass: process.env.EMAIL_PASSWORD,
      },
    });

    const mailOptions = {
      from: process.env.EMAIL,
      to: email,
      subject: isSignup ? "FinPort - Your OTP Code" : "FinPort - Password Reset OTP",
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h2 style="color: #333; text-align: center;">${isSignup ? 'FinPort Verification' : 'Password Reset'}</h2>
          <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <p style="font-size: 16px; color: #333; margin-bottom: 20px;">
              ${isSignup ? 'Welcome to FinPort!' : 'You requested a password reset.'} Your verification code is:
            </p>
            <div style="text-align: center; margin: 30px 0;">
              <span style="font-size: 32px; font-weight: bold; color: #007bff; letter-spacing: 5px; background-color: white; padding: 15px 25px; border: 2px dashed #007bff; border-radius: 8px;">
                ${otp}
              </span>
            </div>
            <p style="font-size: 14px; color: #666; text-align: center;">
              This code will expire in 10 minutes. Please do not share it with anyone.
            </p>
          </div>
          <div style="text-align: center; margin-top: 30px;">
            <p style="font-size: 12px; color: #999;">
              If you didn't request this code, please ignore this email.
            </p>
          </div>
        </div>
      `,
    };

    await transporter.sendMail(mailOptions);

    // Store OTP temporarily (in a real app, use Redis or database)
    global.otpStore = global.otpStore || {};
    global.otpStore[email] = {
      otp,
      timestamp: Date.now(),
      isSignup,
    };

    // Track resend cooldown
    global.resendCooldown[email] = Date.now();

    res.json({ 
      message: "OTP sent to email successfully.",
      canResendAfter: 60 // seconds
    });
  } catch (error) {
    console.error("Error sending OTP:", error);
    res.status(500).json({ error: "Failed to send OTP. Please try again." });
  }
};

const verifyOTP = (req, res) => {
  const { email, otp } = req.body;

  if (!email || !otp) {
    return res.status(400).json({ error: "Email and OTP are required." });
  }

  global.otpStore = global.otpStore || {};
  const storedOtpData = global.otpStore[email];

  if (!storedOtpData) {
    return res.status(400).json({ error: "No OTP found for this email. Please request a new one." });
  }

  // Check if OTP has expired (10 minutes)
  const isExpired = Date.now() - storedOtpData.timestamp > 10 * 60 * 1000;
  if (isExpired) {
    delete global.otpStore[email];
    return res.status(400).json({ error: "OTP has expired. Please request a new one." });
  }

  if (storedOtpData.otp !== otp) {
    return res.status(400).json({ error: "Invalid OTP. Please try again." });
  }

  // Mark as verified
  global.otpStore[email].verified = true;
  
  res.json({ success: true, message: "OTP verified successfully." });
};

const createUser = async (req, res) => {
  const { name, email, password } = req.body;

  if (!name || !email || !password) {
    return res.status(400).json({ error: "Name, email, and password are required." });
  }

  try {
    // Check if OTP was verified
    global.otpStore = global.otpStore || {};
    const otpData = global.otpStore[email];
    
    if (!otpData || !otpData.verified) {
      return res.status(400).json({ error: "Email not verified. Please verify your email first." });
    }

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      return res.status(400).json({ error: "User with this email already exists." });
    }

    // Hash password
    const saltRounds = 12;
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    // Create user in database
    const user = await prisma.user.create({
      data: {
        name,
        email,
        password: hashedPassword,
      },
    });

    // Clean up OTP data
    delete global.otpStore[email];

    res.status(201).json({ 
      message: "User created successfully.",
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        createdAt: user.createdAt
      }
    });
  } catch (error) {
    console.error("Error creating user:", error);
    res.status(500).json({ error: "Failed to create user. Please try again." });
  }
};

const signIn = async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: "Email and password are required." });
  }

  try {
    // Find user in database
    const user = await prisma.user.findUnique({ where: { email } });
    
    if (!user) {
      return res.status(401).json({ error: "Invalid email or password." });
    }

    // Verify password
    const isPasswordValid = await bcrypt.compare(password, user.password);
    
    if (!isPasswordValid) {
      return res.status(401).json({ error: "Invalid email or password." });
    }

    // Generate JWT token
    const token = jwt.sign(
      { 
        userId: user.id, 
        email: user.email,
        name: user.name 
      }, 
      JWT_SECRET, 
      { expiresIn: JWT_EXPIRES_IN }
    );

    // Set secure HTTP-only cookie
    res.cookie('auth_token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 24 * 60 * 60 * 1000, // 24 hours
      path: '/'
    });

    res.json({
      message: "Sign-in successful.",
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
      },
      redirectTo: '/dashboard'
    });
  } catch (error) {
    console.error("Error during sign-in:", error);
    res.status(500).json({ error: "Sign-in failed. Please try again." });
  }
};

const resetPassword = async (req, res) => {
  const { email, otp, newPassword } = req.body;

  if (!email || !otp || !newPassword) {
    return res.status(400).json({ error: "Email, OTP, and new password are required." });
  }

  if (newPassword.length < 8) {
    return res.status(400).json({ error: "Password must be at least 8 characters long." });
  }

  try {
    // Verify OTP first
    global.otpStore = global.otpStore || {};
    const storedOtpData = global.otpStore[email];

    if (!storedOtpData) {
      return res.status(400).json({ error: "No OTP found for this email. Please request a new one." });
    }

    // Check if OTP has expired (10 minutes)
    const isExpired = Date.now() - storedOtpData.timestamp > 10 * 60 * 1000;
    if (isExpired) {
      delete global.otpStore[email];
      return res.status(400).json({ error: "OTP has expired. Please request a new one." });
    }

    if (storedOtpData.otp !== otp) {
      return res.status(400).json({ error: "Invalid OTP. Please try again." });
    }

    // Check if this was a forgot password OTP (not signup)
    if (storedOtpData.isSignup) {
      return res.status(400).json({ error: "This OTP was generated for signup, not password reset." });
    }

    // Find user
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      return res.status(404).json({ error: "User not found." });
    }

    // Hash new password
    const saltRounds = 12;
    const hashedPassword = await bcrypt.hash(newPassword, saltRounds);

    // Update password
    await prisma.user.update({
      where: { email },
      data: { password: hashedPassword }
    });

    // Clean up OTP data
    delete global.otpStore[email];
    delete global.resendCooldown[email];

    res.json({ message: "Password reset successfully. You can now sign in with your new password." });
  } catch (error) {
    console.error("Error resetting password:", error);
    res.status(500).json({ error: "Failed to reset password. Please try again." });
  }
};

const logout = (req, res) => {
  res.clearCookie('auth_token', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/'
  });
  res.json({ message: 'Logged out successfully' });
};

const verifyAuth = (req, res) => {
  const token = req.cookies.auth_token;
  
  if (!token) {
    return res.status(401).json({ error: 'No authentication token found' });
  }
  
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    res.json({ 
      authenticated: true, 
      user: {
        id: decoded.userId,
        name: decoded.name,
        email: decoded.email
      }
    });
  } catch (error) {
    res.clearCookie('auth_token');
    res.status(401).json({ error: 'Invalid or expired token' });
  }
};

// Middleware to protect routes
const authenticateToken = (req, res, next) => {
  const token = req.cookies.auth_token;
  
  if (!token) {
    return res.status(401).json({ error: 'Access denied. No token provided.' });
  }
  
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (error) {
    res.clearCookie('auth_token');
    res.status(401).json({ error: 'Invalid token' });
  }
};

module.exports = { requestOTP, verifyOTP, createUser, signIn, resetPassword, logout, verifyAuth, authenticateToken };
