import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export const validateWorkspaceAccess = async (req, res, next) => {
  const workspaceId = req.params.workspaceId || req.body.workspaceId;
  const userId = req.user.id;

  if (!workspaceId) {
    return res.status(400).json({ error: 'Workspace ID required' });
  }

  try {
    const member = await prisma.workspaceMember.findUnique({
      where: {
        workspaceId_userId: {
          workspaceId,
          userId
        }
      },
      include: {
        workspace: true
      }
    });

    if (!member || member.status !== 'ACTIVE') {
      return res.status(403).json({ error: 'Access denied to workspace' });
    }

    req.workspace = member.workspace;
    req.memberRole = member.role;
    next();
  } catch (error) {
    console.error('Workspace access validation error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const requireWorkspaceRole = (roles) => {
  return (req, res, next) => {
    if (!req.memberRole || !roles.includes(req.memberRole)) {
      return res.status(403).json({ error: 'Insufficient workspace permissions' });
    }
    next();
  };
};