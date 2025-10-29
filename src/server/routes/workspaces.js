import express from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticateToken } from '../middleware/auth.js';
import Joi from 'joi';

const router = express.Router();
const prisma = new PrismaClient();

// Apply authentication to all workspace routes
router.use(authenticateToken);

// Validation schemas
const createWorkspaceSchema = Joi.object({
  name: Joi.string().min(1).max(100).required(),
  description: Joi.string().max(500).allow(''),
  slug: Joi.string().alphanum().min(3).max(50)
});

const inviteMemberSchema = Joi.object({
  email: Joi.string().email().required(),
  role: Joi.string().valid('ADMIN', 'EDITOR', 'MEMBER', 'VIEWER').default('MEMBER')
});

const updateWorkspaceSchema = Joi.object({
  name: Joi.string().min(1).max(100),
  description: Joi.string().max(500).allow(''),
  settings: Joi.object()
});

// Middleware to validate workspace access
const validateWorkspaceAccess = async (req, res, next) => {
  try {
    const { workspaceId } = req.params;
    
    const member = await prisma.workspaceMember.findUnique({
      where: {
        workspaceId_userId: {
          workspaceId,
          userId: req.user.id
        }
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
            }
          }
        }
      }
    });

    if (!member || member.status !== 'ACTIVE') {
      return res.status(403).json({ 
        success: false,
        error: 'Access denied to this workspace' 
      });
    }

    req.workspace = member.workspace;
    req.memberRole = member.role;
    next();
  } catch (error) {
    console.error('Workspace access validation error:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to validate workspace access' 
    });
  }
};

// Middleware to require specific workspace roles
const requireWorkspaceRole = (allowedRoles) => {
  return (req, res, next) => {
    if (!allowedRoles.includes(req.memberRole)) {
      return res.status(403).json({ 
        success: false,
        error: 'Insufficient permissions for this action' 
      });
    }
    next();
  };
};

// Check workspace slug availability
router.post('/check-slug', async (req, res) => {
  try {
    const { slug } = req.body;
    
    if (!slug || slug.length < 3 || slug.length > 50) {
      return res.status(400).json({ 
        available: false,
        error: 'Slug must be between 3 and 50 characters' 
      });
    }

    // Check if slug contains only alphanumeric characters and hyphens
    if (!/^[a-zA-Z0-9-]+$/.test(slug)) {
      return res.status(400).json({ 
        available: false,
        error: 'Slug can only contain letters, numbers, and hyphens' 
      });
    }

    const existingWorkspace = await prisma.workspace.findUnique({
      where: { slug }
    });

    const available = !existingWorkspace;
    
    res.json({ 
      available,
      slug,
      message: available ? 'Slug is available' : 'Slug is already taken'
    });
  } catch (error) {
    console.error('Slug check error:', error);
    res.status(500).json({ 
      available: false,
      error: 'Internal server error' 
    });
  }
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
      orderBy: [
        { role: 'asc' }, // Owners first
        { joinedAt: 'asc' }
      ]
    });

    const formattedWorkspaces = workspaces.map(w => ({
      ...w.workspace,
      role: w.role,
      status: w.status,
      joinedAt: w.joinedAt,
      isOwner: w.role === 'OWNER'
    }));

    res.json({ 
      success: true,
      workspaces: formattedWorkspaces,
      total: formattedWorkspaces.length
    });
  } catch (error) {
    console.error('Get workspaces error:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to fetch workspaces' 
    });
  }
});

// Create workspace
router.post('/', async (req, res) => {
  try {
    const { error, value } = createWorkspaceSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ 
        success: false,
        error: error.details[0].message 
      });
    }

    const { name, description, slug } = value;
    
    // Generate slug if not provided
    let finalSlug = slug;
    if (!finalSlug) {
      // Create slug from name
      finalSlug = name
        .toLowerCase()
        .replace(/[^a-z0-9]/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '')
        .substring(0, 50);
      
      // Add random suffix to ensure uniqueness
      finalSlug += `-${Date.now().toString().slice(-6)}`;
    }

    // Check if slug exists
    const existingWorkspace = await prisma.workspace.findUnique({
      where: { slug: finalSlug }
    });

    if (existingWorkspace) {
      return res.status(400).json({ 
        success: false,
        error: 'Workspace slug already exists. Please choose a different name.' 
      });
    }

    // Create workspace with transaction
    const workspace = await prisma.$transaction(async (tx) => {
      const newWorkspace = await tx.workspace.create({
        data: {
          name,
          description: description || '',
          slug: finalSlug,
          ownerId: req.user.id,
          settings: {
            allowMemberInvites: true,
            defaultVideoStyle: 'CASUAL',
            autoPublish: false
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

      // Add owner as member
      await tx.workspaceMember.create({
        data: {
          workspaceId: newWorkspace.id,
          userId: req.user.id,
          role: 'OWNER',
          status: 'ACTIVE',
          joinedAt: new Date()
        }
      });

      return newWorkspace;
    });

    res.status(201).json({ 
      success: true,
      message: 'Workspace created successfully',
      workspace: {
        ...workspace,
        role: 'OWNER',
        status: 'ACTIVE',
        isOwner: true
      }
    });
  } catch (error) {
    console.error('Create workspace error:', error);
    
    if (error.code === 'P2002') {
      return res.status(400).json({ 
        success: false,
        error: 'Workspace slug already exists' 
      });
    }
    
    res.status(500).json({ 
      success: false,
      error: 'Failed to create workspace' 
    });
  }
});

// Switch to workspace (get workspace details for switching)
router.get('/:workspaceId/switch', validateWorkspaceAccess, async (req, res) => {
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

    res.json({ 
      success: true,
      workspace: {
        ...workspace,
        role: req.memberRole,
        isOwner: req.memberRole === 'OWNER'
      }
    });
  } catch (error) {
    console.error('Switch workspace error:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to switch workspace' 
    });
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

    res.json({ 
      success: true,
      workspace,
      userRole: req.memberRole,
      isOwner: req.memberRole === 'OWNER'
    });
  } catch (error) {
    console.error('Get workspace error:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to fetch workspace' 
    });
  }
});

// Update workspace
router.put('/:workspaceId', validateWorkspaceAccess, requireWorkspaceRole(['OWNER', 'ADMIN']), async (req, res) => {
  try {
    const { workspaceId } = req.params;
    const { error, value } = updateWorkspaceSchema.validate(req.body);
    
    if (error) {
      return res.status(400).json({ 
        success: false,
        error: error.details[0].message 
      });
    }

    const { name, description, settings } = value;
    
    const workspace = await prisma.workspace.update({
      where: { id: workspaceId },
      data: {
        ...(name && { name }),
        ...(description !== undefined && { description }),
        ...(settings && { settings: { ...req.workspace.settings, ...settings } }),
        updatedAt: new Date()
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

    res.json({ 
      success: true,
      message: 'Workspace updated successfully',
      workspace
    });
  } catch (error) {
    console.error('Update workspace error:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to update workspace' 
    });
  }
});

// Invite member
router.post('/:workspaceId/invite', validateWorkspaceAccess, requireWorkspaceRole(['OWNER', 'ADMIN']), async (req, res) => {
  try {
    const { workspaceId } = req.params;
    const { error, value } = inviteMemberSchema.validate(req.body);
    
    if (error) {
      return res.status(400).json({ 
        success: false,
        error: error.details[0].message 
      });
    }

    const { email, role } = value;
    
    // Find user by email
    const user = await prisma.user.findUnique({
      where: { email }
    });

    if (!user) {
      return res.status(404).json({ 
        success: false,
        error: 'No user found with this email address' 
      });
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
      const status = existingMember.status === 'PENDING' ? 'already invited' : 'already a member';
      return res.status(400).json({ 
        success: false,
        error: `User is ${status}` 
      });
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

    res.status(201).json({ 
      success: true,
      message: 'Member invited successfully',
      member
    });
  } catch (error) {
    console.error('Invite member error:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to invite member' 
    });
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
      return res.status(400).json({ 
        success: false,
        error: 'No pending invitation found' 
      });
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
      }
    });

    res.json({ 
      success: true,
      message: 'Invitation accepted successfully',
      workspace: {
        ...updatedMember.workspace,
        role: updatedMember.role,
        status: updatedMember.status,
        joinedAt: updatedMember.joinedAt
      }
    });
  } catch (error) {
    console.error('Accept invitation error:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to accept invitation' 
    });
  }
});

// Decline workspace invitation
router.post('/:workspaceId/decline', async (req, res) => {
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
      return res.status(400).json({ 
        success: false,
        error: 'No pending invitation found' 
      });
    }

    await prisma.workspaceMember.delete({
      where: {
        workspaceId_userId: {
          workspaceId,
          userId: req.user.id
        }
      }
    });

    res.json({ 
      success: true,
      message: 'Invitation declined' 
    });
  } catch (error) {
    console.error('Decline invitation error:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to decline invitation' 
    });
  }
});

// Leave workspace
router.post('/:workspaceId/leave', validateWorkspaceAccess, async (req, res) => {
  try {
    const { workspaceId } = req.params;
    
    // Owners can't leave their workspace
    if (req.memberRole === 'OWNER') {
      return res.status(400).json({ 
        success: false,
        error: 'Workspace owners cannot leave. Transfer ownership first or delete the workspace.' 
      });
    }

    await prisma.workspaceMember.delete({
      where: {
        workspaceId_userId: {
          workspaceId,
          userId: req.user.id
        }
      }
    });

    res.json({ 
      success: true,
      message: 'Left workspace successfully' 
    });
  } catch (error) {
    console.error('Leave workspace error:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to leave workspace' 
    });
  }
});

// Remove member
router.delete('/:workspaceId/members/:userId', validateWorkspaceAccess, requireWorkspaceRole(['OWNER', 'ADMIN']), async (req, res) => {
  try {
    const { workspaceId, userId } = req.params;
    
    // Can't remove the owner
    if (req.workspace.ownerId === userId) {
      return res.status(400).json({ 
        success: false,
        error: 'Cannot remove workspace owner' 
      });
    }

    // Admins can't remove other admins (only owners can)
    if (req.memberRole === 'ADMIN') {
      const targetMember = await prisma.workspaceMember.findUnique({
        where: {
          workspaceId_userId: {
            workspaceId,
            userId
          }
        }
      });

      if (targetMember?.role === 'ADMIN') {
        return res.status(403).json({ 
          success: false,
          error: 'Only workspace owners can remove admins' 
        });
      }
    }

    await prisma.workspaceMember.delete({
      where: {
        workspaceId_userId: {
          workspaceId,
          userId
        }
      }
    });

    res.json({ 
      success: true,
      message: 'Member removed successfully' 
    });
  } catch (error) {
    console.error('Remove member error:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to remove member' 
    });
  }
});

// Update member role
router.put('/:workspaceId/members/:userId/role', validateWorkspaceAccess, requireWorkspaceRole(['OWNER']), async (req, res) => {
  try {
    const { workspaceId, userId } = req.params;
    const { role } = req.body;
    
    if (!['ADMIN', 'EDITOR', 'MEMBER', 'VIEWER'].includes(role)) {
      return res.status(400).json({ 
        success: false,
        error: 'Invalid role specified' 
      });
    }

    // Can't change owner role
    if (req.workspace.ownerId === userId) {
      return res.status(400).json({ 
        success: false,
        error: 'Cannot change workspace owner role' 
      });
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

    res.json({ 
      success: true,
      message: 'Member role updated successfully',
      member
    });
  } catch (error) {
    console.error('Update member role error:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to update member role' 
    });
  }
});

// Delete workspace (owner only)
router.delete('/:workspaceId', validateWorkspaceAccess, requireWorkspaceRole(['OWNER']), async (req, res) => {
  try {
    const { workspaceId } = req.params;
    
    // Soft delete by updating status
    await prisma.workspace.update({
      where: { id: workspaceId },
      data: {
        status: 'DELETED',
        updatedAt: new Date()
      }
    });

    res.json({ 
      success: true,
      message: 'Workspace deleted successfully' 
    });
  } catch (error) {
    console.error('Delete workspace error:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to delete workspace' 
    });
  }
});

export default router;