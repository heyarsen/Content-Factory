import express from 'express';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { PrismaClient } from '@prisma/client';
import nodemailer from 'nodemailer';
import Joi from 'joi';
import { passwordResetLimiter } from '../middleware/rateLimiter.js';

const router = express.Router();
const prisma = new PrismaClient();

// Email transporter setup
const createTransporter = () => {
  if (process.env.NODE_ENV === 'development') {
    // Use Ethereal Email for development
    return nodemailer.createTransporter({
      host: 'smtp.ethereal.email',
      port: 587,
      secure: false,
      auth: {
        user: process.env.ETHEREAL_EMAIL || 'ethereal.user@ethereal.email',
        pass: process.env.ETHEREAL_PASS || 'ethereal.pass'
      }
    });
  }
  
  // Production SMTP configuration
  return nodemailer.createTransporter({
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT) || 587,
    secure: process.env.SMTP_SECURE === 'true',
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS
    }
  });
};

// Validation schemas
const requestResetSchema = Joi.object({
  email: Joi.string().email().required()
});

const resetPasswordSchema = Joi.object({
  token: Joi.string().required(),
  password: Joi.string().min(8).required(),
  confirmPassword: Joi.string().valid(Joi.ref('password')).required()
});

// Request password reset
router.post('/request-reset', passwordResetLimiter, async (req, res) => {
  try {
    const { error, value } = requestResetSchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        success: false,
        error: error.details[0].message
      });
    }

    const { email } = value;

    // Find user
    const user = await prisma.user.findUnique({
      where: { email }
    });

    // Always return success to prevent email enumeration
    if (!user) {
      return res.json({
        success: true,
        message: 'If an account with that email exists, we\'ve sent password reset instructions.'
      });
    }

    // Generate reset token
    const resetToken = crypto.randomBytes(32).toString('hex');
    const resetTokenExpiry = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    // Store reset token in database
    await prisma.passwordReset.upsert({
      where: { userId: user.id },
      update: {
        token: resetToken,
        expiresAt: resetTokenExpiry,
        used: false
      },
      create: {
        userId: user.id,
        token: resetToken,
        expiresAt: resetTokenExpiry,
        used: false
      }
    });

    // Send reset email
    const transporter = createTransporter();
    const resetUrl = `${process.env.FRONTEND_URL}/reset-password?token=${resetToken}`;

    const mailOptions = {
      from: process.env.FROM_EMAIL || 'noreply@contentfactory.com',
      to: email,
      subject: 'Reset Your Content Factory Password',
      html: `
        <div style="max-width: 600px; margin: 0 auto; font-family: Arial, sans-serif;">
          <h2 style="color: #2563eb;">Reset Your Password</h2>
          <p>Hello ${user.firstName || user.username},</p>
          <p>You requested a password reset for your Content Factory account.</p>
          <p>Click the button below to reset your password:</p>
          <div style="text-align: center; margin: 30px 0;">
            <a href="${resetUrl}" 
               style="background-color: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;"
            >
              Reset Password
            </a>
          </div>
          <p>Or copy and paste this link into your browser:</p>
          <p style="color: #6b7280; word-break: break-all;">${resetUrl}</p>
          <p><strong>This link will expire in 1 hour.</strong></p>
          <p>If you didn't request this password reset, you can safely ignore this email.</p>
          <hr style="margin: 30px 0; border: none; border-top: 1px solid #e5e7eb;">
          <p style="color: #6b7280; font-size: 14px;">Content Factory Team</p>
        </div>
      `
    };

    await transporter.sendMail(mailOptions);

    console.log(`Password reset email sent to ${email}`);

    res.json({
      success: true,
      message: 'If an account with that email exists, we\'ve sent password reset instructions.'
    });
  } catch (error) {
    console.error('Password reset request error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to process password reset request. Please try again.'
    });
  }
});

// Verify reset token
router.get('/verify-token/:token', async (req, res) => {
  try {
    const { token } = req.params;

    const passwordReset = await prisma.passwordReset.findFirst({
      where: {
        token,
        used: false,
        expiresAt: {
          gt: new Date()
        }
      },
      include: {
        user: {
          select: {
            email: true,
            firstName: true,
            lastName: true
          }
        }
      }
    });

    if (!passwordReset) {
      return res.status(400).json({
        success: false,
        error: 'Invalid or expired reset token',
        expired: true
      });
    }

    res.json({
      success: true,
      user: {
        email: passwordReset.user.email,
        firstName: passwordReset.user.firstName,
        lastName: passwordReset.user.lastName
      }
    });
  } catch (error) {
    console.error('Token verification error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to verify reset token'
    });
  }
});

// Reset password
router.post('/reset-password', passwordResetLimiter, async (req, res) => {
  try {
    const { error, value } = resetPasswordSchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        success: false,
        error: error.details[0].message
      });
    }

    const { token, password } = value;

    // Find and validate reset token
    const passwordReset = await prisma.passwordReset.findFirst({
      where: {
        token,
        used: false,
        expiresAt: {
          gt: new Date()
        }
      },
      include: {
        user: true
      }
    });

    if (!passwordReset) {
      return res.status(400).json({
        success: false,
        error: 'Invalid or expired reset token',
        expired: true
      });
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(password, 12);

    // Update user password and mark token as used
    await prisma.$transaction(async (tx) => {
      // Update password
      await tx.user.update({
        where: { id: passwordReset.userId },
        data: { password: hashedPassword }
      });

      // Mark reset token as used
      await tx.passwordReset.update({
        where: { id: passwordReset.id },
        data: { used: true }
      });

      // Invalidate all existing sessions for security
      await tx.session.deleteMany({
        where: { userId: passwordReset.userId }
      });
    });

    console.log(`Password reset successful for user: ${passwordReset.user.email}`);

    res.json({
      success: true,
      message: 'Password reset successful. Please log in with your new password.'
    });
  } catch (error) {
    console.error('Password reset error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to reset password. Please try again.'
    });
  }
});

export default router;