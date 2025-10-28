import express from 'express';
import { PrismaClient } from '@prisma/client';
import { validateWorkspaceAccess, requireWorkspaceRole } from '../middleware/workspace.js';
import Joi from 'joi';

const router = express.Router();
const prisma = new PrismaClient();

// Validation schemas
const createWorkspaceSchema = Joi.object({
  name: Joi.string().min(1).max(100).required(),
  description: Joi.string().max(500),
  slug: Joi.string().alphanum().min(3).max(50)
});

const inviteMemberSchema = Joi.object({
  email: Joi.string().email().required(),
  role: Joi.string().valid('ADMIN', 'EDITOR', 'MEMBER', 'VIEWER').default('MEMBER')
});

// Get user workspaces
router.get('/', async (req, res) => {
  try {
    const workspaces = await prisma.workspaceMember.findMany({
      where: {
        userId: req.user.id,
        status: 'ACTIVE'
      },
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
      orderBy: {
        workspace: {
          createdAt: 'desc'
        }
      }
    });

    res.json({ workspaces: workspaces.map(w => ({ ...w.workspace, role: w.role })) });
  } catch (error) {
    console.error('Get workspaces error:', error);
    res.status(500).json({ error: 'Failed to fetch workspaces' });
  }
});

// Create workspace
router.post('/', async (req, res) => {
  try {
    const { error, value } = createWorkspaceSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }

    const { name, description, slug } = value;
    const finalSlug = slug || name.toLowerCase().replace(/[^a-z0-9]/g, '-');

    // Check if slug exists
    const existingWorkspace = await prisma.workspace.findUnique({
      where: { slug: finalSlug }
    });

    if (existingWorkspace) {
      return res.status(400).json({ error: 'Workspace slug already exists' });
    }

    const workspace = await prisma.workspace.create({
      data: {
        name,
        description,
        slug: finalSlug,
        ownerId: req.user.id,
        members: {
          create: {
            userId: req.user.id,
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

    res.status(201).json({ workspace });
  } catch (error) {
    console.error('Create workspace error:', error);
    res.status(500).json({ error: 'Failed to create workspace' });
  }
});

// Get workspace details
router.get('/:workspaceId', validateWorkspaceAccess, async (req, res) => {
  try {
    const { workspaceId } = req.params;
    
    const workspace = await prisma.workspace.findUnique({
      where: { id: workspaceId },
      include: {
        owner: {
          select: {
            firstName: true,
            lastName: true,
            username: true,
            avatar: true
          }
        },
        members: {
          include: {
            user: {
              select: {
                firstName: true,
                lastName: true,
                username: true,
                avatar: true,
                lastLoginAt: true
              }
            }
          },
          orderBy: { joinedAt: 'asc' }
        },
        _count: {
          select: {
            videos: true,
            posts: true,
            calendar: true
          }
        }
      }
    });

    res.json({ workspace, userRole: req.memberRole });
  } catch (error) {
    console.error('Get workspace error:', error);
    res.status(500).json({ error: 'Failed to fetch workspace' });
  }
});

// Update workspace
router.put('/:workspaceId', validateWorkspaceAccess, requireWorkspaceRole(['OWNER', 'ADMIN']), async (req, res) => {
  try {
    const { workspaceId } = req.params;
    const { name, description, settings } = req.body;
    
    const workspace = await prisma.workspace.update({
      where: { id: workspaceId },
      data: {
        ...(name && { name }),
        ...(description && { description }),
        ...(settings && { settings })
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

    res.json({ workspace });
  } catch (error) {
    console.error('Update workspace error:', error);
    res.status(500).json({ error: 'Failed to update workspace' });
  }
});

// Invite member
router.post('/:workspaceId/invite', validateWorkspaceAccess, requireWorkspaceRole(['OWNER', 'ADMIN']), async (req, res) => {
  try {
    const { workspaceId } = req.params;
    const { error, value } = inviteMemberSchema.validate(req.body);
    
    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }

    const { email, role } = value;
    
    // Find user by email
    const user = await prisma.user.findUnique({
      where: { email }
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Check if already a member
    const existingMember = await prisma.workspaceMember.findUnique({
      where: {
        workspaceId_userId: {
          workspaceId,
          userId: user.id
        }
      }
    });

    if (existingMember) {
      return res.status(400).json({ error: 'User is already a member' });
    }

    const member = await prisma.workspaceMember.create({
      data: {
        workspaceId,
        userId: user.id,
        role,
        status: 'PENDING'
      },
      include: {
        user: {
          select: {
            firstName: true,
            lastName: true,
            username: true,
            avatar: true,
            email: true
          }
        }
      }
    });

    // Create notification for invited user
    await prisma.notification.create({
      data: {
        userId: user.id,
        type: 'MEMBER_JOINED',
        title: 'Workspace Invitation',
        message: `You've been invited to join ${req.workspace.name}`,
        data: { workspaceId, role }
      }
    });

    res.status(201).json({ member });
  } catch (error) {
    console.error('Invite member error:', error);
    res.status(500).json({ error: 'Failed to invite member' });
  }
});

// Accept workspace invitation
router.post('/:workspaceId/accept', async (req, res) => {
  try {
    const { workspaceId } = req.params;
    
    const member = await prisma.workspaceMember.findUnique({
      where: {
        workspaceId_userId: {
          workspaceId,
          userId: req.user.id
        }
      }
    });

    if (!member || member.status !== 'PENDING') {
      return res.status(400).json({ error: 'No pending invitation found' });
    }

    const updatedMember = await prisma.workspaceMember.update({
      where: {
        workspaceId_userId: {
          workspaceId,
          userId: req.user.id
        }
      },
      data: {
        status: 'ACTIVE',
        joinedAt: new Date()
      },
      include: {
        workspace: true
      }
    });

    res.json({ member: updatedMember, message: 'Invitation accepted' });
  } catch (error) {
    console.error('Accept invitation error:', error);
    res.status(500).json({ error: 'Failed to accept invitation' });
  }
});

// Remove member
router.delete('/:workspaceId/members/:userId', validateWorkspaceAccess, requireWorkspaceRole(['OWNER', 'ADMIN']), async (req, res) => {
  try {
    const { workspaceId, userId } = req.params;
    
    // Can't remove the owner
    if (req.workspace.ownerId === userId) {
      return res.status(400).json({ error: 'Cannot remove workspace owner' });
    }

    await prisma.workspaceMember.delete({
      where: {
        workspaceId_userId: {
          workspaceId,
          userId
        }
      }
    });

    res.json({ message: 'Member removed successfully' });
  } catch (error) {
    console.error('Remove member error:', error);
    res.status(500).json({ error: 'Failed to remove member' });
  }
});

// Update member role
router.put('/:workspaceId/members/:userId/role', validateWorkspaceAccess, requireWorkspaceRole(['OWNER']), async (req, res) => {
  try {
    const { workspaceId, userId } = req.params;
    const { role } = req.body;
    
    if (!['ADMIN', 'EDITOR', 'MEMBER', 'VIEWER'].includes(role)) {
      return res.status(400).json({ error: 'Invalid role' });
    }

    // Can't change owner role
    if (req.workspace.ownerId === userId) {
      return res.status(400).json({ error: 'Cannot change owner role' });
    }

    const member = await prisma.workspaceMember.update({
      where: {
        workspaceId_userId: {
          workspaceId,
          userId
        }
      },
      data: { role },
      include: {
        user: {
          select: {
            firstName: true,
            lastName: true,
            username: true,
            avatar: true
          }
        }
      }
    });

    res.json({ member });
  } catch (error) {
    console.error('Update member role error:', error);
    res.status(500).json({ error: 'Failed to update member role' });
  }
});

export default router;