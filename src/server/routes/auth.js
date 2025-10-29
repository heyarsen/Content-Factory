import express from 'express';
import bcrypt from 'bcryptjs';
import { PrismaClient } from '@prisma/client';
import { generateTokens, authenticateToken } from '../middleware/auth.js';
import Joi from 'joi';

const router = express.Router();
const prisma = new PrismaClient();

// Validation schemas
const registerSchema = Joi.object({
  email: Joi.string().email().required(),
  username: Joi.string().alphanum().min(3).max(30).required(),
  firstName: Joi.string().min(1).max(50).allow(''),
  lastName: Joi.string().min(1).max(50).allow(''),
  password: Joi.string().min(8).required()
});

const loginSchema = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().required()
});

const usernameCheckSchema = Joi.object({
  username: Joi.string().alphanum().min(3).max(30).required()
});

// Check username availability
router.post('/check-username', async (req, res) => {
  try {
    const { error, value } = usernameCheckSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ 
        available: false, 
        error: error.details[0].message 
      });
    }

    const { username } = value;

    const existingUser = await prisma.user.findUnique({
      where: { username }
    });

    const available = !existingUser;
    
    res.json({ 
      available,
      username,
      message: available ? 'Username is available' : 'Username is already taken'
    });
  } catch (err) {
    console.error('Username check error:', err);
    res.status(500).json({ 
      available: false, 
      error: 'Internal server error' 
    });
  }
});

// Check email availability
router.post('/check-email', async (req, res) => {
  try {
    const { email } = req.body;
    
    if (!email) {
      return res.status(400).json({ 
        available: false, 
        error: 'Email is required' 
      });
    }

    const emailValidation = Joi.string().email().validate(email);
    if (emailValidation.error) {
      return res.status(400).json({ 
        available: false, 
        error: 'Valid email is required' 
      });
    }

    const existingUser = await prisma.user.findUnique({
      where: { email }
    });

    const available = !existingUser;
    
    res.json({ 
      available,
      email,
      message: available ? 'Email is available' : 'Email is already registered'
    });
  } catch (err) {
    console.error('Email check error:', err);
    res.status(500).json({ 
      available: false, 
      error: 'Internal server error' 
    });
  }
});

// Register
router.post('/register', async (req, res) => {
  try {
    console.log('Registration attempt:', { ...req.body, password: '[HIDDEN]' });
    
    const { error, value } = registerSchema.validate(req.body);
    if (error) {
      console.log('Validation error:', error.details[0].message);
      return res.status(400).json({ 
        success: false,
        error: error.details[0].message 
      });
    }

    const { email, username, firstName, lastName, password } = value;

    // Check if user exists (email or username)
    const existingUser = await prisma.user.findFirst({
      where: {
        OR: [{ email }, { username }]
      }
    });

    if (existingUser) {
      const field = existingUser.email === email ? 'email' : 'username';
      console.log('User already exists:', field, existingUser.email === email ? email : username);
      return res.status(400).json({ 
        success: false,
        error: `This ${field} is already registered`,
        field
      });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 12);
    console.log('Password hashed successfully');

    // Create user and default workspace in a transaction
    const result = await prisma.$transaction(async (tx) => {
      // Create user
      const user = await tx.user.create({
        data: {
          email,
          username,
          firstName: firstName || null,
          lastName: lastName || null,
          password: hashedPassword
        }
      });
      console.log('User created:', user.id, user.email);

      // Create default workspace
      const workspaceName = firstName ? `${firstName}'s Workspace` : `${username}'s Workspace`;
      const workspaceSlug = `${username}-workspace-${Date.now()}`;
      
      const workspace = await tx.workspace.create({
        data: {
          name: workspaceName,
          slug: workspaceSlug,
          description: 'Your personal workspace',
          ownerId: user.id,
          members: {
            create: {
              userId: user.id,
              role: 'OWNER',
              status: 'ACTIVE',
              joinedAt: new Date()
            }
          }
        },
        include: {
          owner: {
            select: {
              firstName: true,
              lastName: true,
              username: true,
              avatar: true
            }
          },
          _count: {
            select: {
              members: true,
              videos: true,
              posts: true
            }
          }
        }
      });
      console.log('Workspace created:', workspace.id, workspace.name);

      return { user, workspace };
    });

    // Generate tokens
    const { token, expiresAt } = await generateTokens(result.user.id);
    console.log('Token generated successfully');

    res.status(201).json({
      success: true,
      message: 'Account created successfully',
      token,
      expiresAt,
      user: {
        id: result.user.id,
        email: result.user.email,
        username: result.user.username,
        firstName: result.user.firstName,
        lastName: result.user.lastName,
        role: result.user.role,
        avatar: result.user.avatar
      },
      workspace: result.workspace
    });
  } catch (err) {
    console.error('Registration error:', err);
    res.status(500).json({ 
      success: false,
      error: 'Failed to create account. Please try again.' 
    });
  }
});

// Login with improved error handling
router.post('/login', async (req, res) => {
  try {
    console.log('Login attempt for email:', req.body.email);
    
    const { error, value } = loginSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ 
        success: false,
        error: error.details[0].message,
        email: req.body.email // Preserve email
      });
    }

    const { email, password } = value;

    // Find user first (separate from password check for better error messages)
    const user = await prisma.user.findUnique({ 
      where: { email },
      include: {
        workspaces: {
          include: {
            workspace: {
              include: {
                owner: {
                  select: {
                    firstName: true,
                    lastName: true,
                    username: true,
                    avatar: true
                  }
                },
                _count: {
                  select: {
                    members: true,
                    videos: true,
                    posts: true
                  }
                }
              }
            }
          },
          where: {
            status: 'ACTIVE'
          },
          orderBy: {
            joinedAt: 'asc'
          }
        }
      }
    });
    
    if (!user) {
      console.log('User not found:', email);
      return res.status(401).json({ 
        success: false,
        error: 'No account found with this email address',
        errorType: 'email_not_found',
        email: email // Preserve email
      });
    }

    if (user.status !== 'ACTIVE') {
      console.log('User account not active:', email, user.status);
      return res.status(401).json({ 
        success: false,
        error: 'Account is not active. Please contact support.',
        errorType: 'account_inactive',
        email: email // Preserve email
      });
    }

    // Check password
    console.log('Checking password for user:', user.id);
    const isPasswordValid = await bcrypt.compare(password, user.password);
    
    if (!isPasswordValid) {
      console.log('Invalid password for user:', email);
      return res.status(401).json({ 
        success: false,
        error: 'Incorrect password. Please check your password and try again.',
        errorType: 'invalid_password',
        email: email // Preserve email
      });
    }

    console.log('Login successful for user:', user.id);

    // Update last login
    await prisma.user.update({ 
      where: { id: user.id }, 
      data: { lastLoginAt: new Date() } 
    });

    // Generate tokens
    const { token, expiresAt } = await generateTokens(user.id);
    console.log('Token generated for user:', user.id);

    // Get user's primary workspace (owned workspace first, then first active)
    const ownedWorkspace = user.workspaces.find(w => w.role === 'OWNER');
    const primaryWorkspace = ownedWorkspace || user.workspaces[0];

    const responseData = {
      success: true,
      message: 'Login successful',
      token,
      expiresAt,
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        avatar: user.avatar,
        lastLoginAt: user.lastLoginAt
      },
      workspace: primaryWorkspace?.workspace || null,
      workspaces: user.workspaces.map(w => ({
        ...w.workspace,
        role: w.role,
        status: w.status,
        joinedAt: w.joinedAt
      }))
    };

    console.log('Sending login response for user:', user.id, {
      hasToken: !!responseData.token,
      hasWorkspace: !!responseData.workspace,
      workspaceCount: responseData.workspaces.length
    });

    res.json(responseData);
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ 
      success: false,
      error: 'Login failed due to server error. Please try again.',
      email: req.body.email // Preserve email even on server error
    });
  }
});

// Verify token endpoint
router.get('/verify', authenticateToken, async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      include: {
        workspaces: {
          include: {
            workspace: {
              include: {
                owner: {
                  select: {
                    firstName: true,
                    lastName: true,
                    username: true,
                    avatar: true
                  }
                },
                _count: {
                  select: {
                    members: true,
                    videos: true,
                    posts: true
                  }
                }
              }
            }
          },
          where: {
            status: 'ACTIVE'
          },
          orderBy: {
            joinedAt: 'asc'
          }
        }
      }
    });

    if (!user) {
      return res.status(404).json({ 
        success: false,
        error: 'User not found' 
      });
    }

    // Get user's primary workspace
    const ownedWorkspace = user.workspaces.find(w => w.role === 'OWNER');
    const primaryWorkspace = ownedWorkspace || user.workspaces[0];

    res.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        avatar: user.avatar,
        lastLoginAt: user.lastLoginAt
      },
      workspace: primaryWorkspace?.workspace || null,
      workspaces: user.workspaces.map(w => ({
        ...w.workspace,
        role: w.role,
        status: w.status,
        joinedAt: w.joinedAt
      }))
    });
  } catch (err) {
    console.error('Token verification error:', err);
    res.status(500).json({ 
      success: false,
      error: 'Token verification failed' 
    });
  }
});

// Debug endpoint to check user existence
router.post('/debug-user', async (req, res) => {
  try {
    const { email } = req.body;
    
    if (!email) {
      return res.status(400).json({ error: 'Email required' });
    }

    const user = await prisma.user.findUnique({
      where: { email },
      select: {
        id: true,
        email: true,
        username: true,
        firstName: true,
        lastName: true,
        status: true,
        createdAt: true,
        _count: {
          select: {
            workspaces: true
          }
        }
      }
    });

    if (!user) {
      return res.json({ 
        found: false, 
        message: 'User not found' 
      });
    }

    res.json({
      found: true,
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        firstName: user.firstName,
        lastName: user.lastName,
        status: user.status,
        createdAt: user.createdAt,
        workspaceCount: user._count.workspaces
      }
    });
  } catch (err) {
    console.error('Debug user error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Logout endpoint
router.post('/logout', authenticateToken, async (req, res) => {
  try {
    // Delete the session
    await prisma.session.delete({
      where: { token: req.session.token }
    });

    res.json({ 
      success: true,
      message: 'Logged out successfully' 
    });
  } catch (err) {
    console.error('Logout error:', err);
    res.status(500).json({ 
      success: false,
      error: 'Logout failed' 
    });
  }
});

// Get user profile
router.get('/profile', authenticateToken, async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: {
        id: true,
        email: true,
        username: true,
        firstName: true,
        lastName: true,
        role: true,
        avatar: true,
        status: true,
        emailVerified: true,
        createdAt: true,
        lastLoginAt: true
      }
    });

    if (!user) {
      return res.status(404).json({ 
        success: false,
        error: 'User not found' 
      });
    }

    res.json({
      success: true,
      user
    });
  } catch (err) {
    console.error('Get profile error:', err);
    res.status(500).json({ 
      success: false,
      error: 'Failed to fetch profile' 
    });
  }
});

// Update user profile
router.put('/profile', authenticateToken, async (req, res) => {
  try {
    const { firstName, lastName, avatar } = req.body;
    
    const user = await prisma.user.update({
      where: { id: req.user.id },
      data: {
        ...(firstName !== undefined && { firstName }),
        ...(lastName !== undefined && { lastName }),
        ...(avatar !== undefined && { avatar })
      },
      select: {
        id: true,
        email: true,
        username: true,
        firstName: true,
        lastName: true,
        role: true,
        avatar: true,
        status: true,
        emailVerified: true,
        createdAt: true,
        lastLoginAt: true
      }
    });

    res.json({
      success: true,
      message: 'Profile updated successfully',
      user
    });
  } catch (err) {
    console.error('Update profile error:', err);
    res.status(500).json({ 
      success: false,
      error: 'Failed to update profile' 
    });
  }
});

export default router;