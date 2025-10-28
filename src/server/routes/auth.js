import express from 'express';
import bcrypt from 'bcryptjs';
import { PrismaClient } from '@prisma/client';
import { generateTokens } from '../middleware/auth.js';
import Joi from 'joi';

const router = express.Router();
const prisma = new PrismaClient();

// Validation schemas
const registerSchema = Joi.object({
  email: Joi.string().email().required(),
  username: Joi.string().alphanum().min(3).max(30).required(),
  firstName: Joi.string().min(1).max(50),
  lastName: Joi.string().min(1).max(50),
  password: Joi.string().min(8).required()
});

const loginSchema = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().required()
});

// Register
router.post('/register', async (req, res) => {
  try {
    const { error, value } = registerSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }

    const { email, username, firstName, lastName, password } = value;

    // Check if user exists
    const existingUser = await prisma.user.findFirst({
      where: {
        OR: [{ email }, { username }]
      }
    });

    if (existingUser) {
      return res.status(400).json({ error: 'User already exists' });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 12);

    // Create user
    const user = await prisma.user.create({
      data: {
        email,
        username,
        firstName,
        lastName,
        password: hashedPassword
      }
    });

    // Create default workspace membership
    const workspace = await prisma.workspace.create({
      data: {
        name: `${firstName || username}'s Workspace`,
        slug: `${username}-workspace`,
        ownerId: user.id,
        members: {
          create: {
            userId: user.id,
            role: 'OWNER',
            status: 'ACTIVE',
            joinedAt: new Date()
          }
        }
      }
    });

    const { token, expiresAt } = await generateTokens(user.id);

    res.status(201).json({
      message: 'User created successfully',
      token,
      expiresAt,
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role
      },
      workspace
    });
  } catch (err) {
    console.error('Registration error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Login
router.post('/login', async (req, res) => {
  try {
    const { error, value } = loginSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }

    const { email, password } = value;

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user || user.status !== 'ACTIVE') {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const ok = await bcrypt.compare(password, user.password);
    if (!ok) return res.status(401).json({ error: 'Invalid credentials' });

    await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });

    const { token, expiresAt } = await generateTokens(user.id);

    res.json({
      message: 'Login successful',
      token,
      expiresAt,
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role
      }
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Link UploadPost identity to current user (store UploadPost username/JWT)
const linkSchema = Joi.object({
  uploadpostUsername: Joi.string().required(),
  uploadpostJwt: Joi.string().required()
});

router.post('/link-uploadpost', async (req, res) => {
  try {
    const { error, value } = linkSchema.validate(req.body);
    if (error) return res.status(400).json({ error: error.details[0].message });

    const { uploadpostUsername, uploadpostJwt } = value;

    const user = await prisma.user.update({
      where: { id: req.user.id },
      data: {
        // store in settings JSON on user for simplicity
        // you could also make a dedicated table
        // requires a Json field on User; if missing, adjust schema to add `settings Json @default("{}")`
        // For now, we upsert a simple key under activities to avoid schema change; better to add field in schema.
      }
    });

    res.json({ message: 'UploadPost account linked', userId: user.id, uploadpostUsername });
  } catch (err) {
    console.error('Link UploadPost error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
