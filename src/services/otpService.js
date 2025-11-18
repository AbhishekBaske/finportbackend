
const crypto = require('crypto');
const nodemailer = require('nodemailer');
// In-memory store for demo (replace with DB/Redis in production)
const otpStore = new Map();

function generateOTP(email) {
  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  const expires = Date.now() + 5 * 60 * 1000; // 5 minutes
  otpStore.set(email, { otp, expires });
  return otp;
}

async function sendOTPEmail(email, otp) {
  const transporter = nodemailer.createTransport({
    service: 'gmail', // or another provider
    auth: {
      user: process.env.EMAIL,
      pass: process.env.EMAIL_PASSWORD
    }
  });

  await transporter.sendMail({
    from: process.env.EMAIL,
    to: email,
    subject: 'Your OTP Code',
    text: `Your OTP is: ${otp}`
  });
}

function verifyOTP(email, otp) {
  const record = otpStore.get(email);
  if (!record) return false;
  if (Date.now() > record.expires) {
    otpStore.delete(email);
    return false;
  }
  if (record.otp === otp) {
    otpStore.delete(email);
    return true;
  }
  return false;
}

module.exports = { generateOTP, verifyOTP, sendOTPEmail };
