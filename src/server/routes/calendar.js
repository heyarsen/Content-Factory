import express from 'express';
import { PrismaClient } from '@prisma/client';
import { validateWorkspaceAccess } from '../middleware/workspace.js';
import Joi from 'joi';

const router = express.Router();
const prisma = new PrismaClient();

// Validation schemas
const createEventSchema = Joi.object({
  title: Joi.string().min(1).max(200).required(),
  description: Joi.string().max(1000),
  startDate: Joi.date().required(),
  endDate: Joi.date().required(),
  allDay: Joi.boolean().default(false),
  type: Joi.string().valid('VIDEO_CREATION', 'POST_SCHEDULE', 'CAMPAIGN_START', 'CAMPAIGN_END', 'MEETING', 'DEADLINE').default('VIDEO_CREATION'),
  workspaceId: Joi.string().required(),
  metadata: Joi.object().default({})
});

// Get workspace calendar events
router.get('/workspace/:workspaceId', validateWorkspaceAccess, async (req, res) => {
  try {
    const { workspaceId } = req.params;
    const { start, end, type } = req.query;
    
    const where = { workspaceId };
    if (type) where.type = type;
    
    // Date range filter
    if (start || end) {
      where.OR = [
        {
          startDate: {
            ...(start && { gte: new Date(start) }),
            ...(end && { lte: new Date(end) })
          }
        },
        {
          endDate: {
            ...(start && { gte: new Date(start) }),
            ...(end && { lte: new Date(end) })
          }
        }
      ];
    }

    const events = await prisma.calendarEvent.findMany({
      where,
      orderBy: { startDate: 'asc' }
    });

    res.json({ events });
  } catch (error) {
    console.error('Get calendar events error:', error);
    res.status(500).json({ error: 'Failed to fetch calendar events' });
  }
});

// Create calendar event
router.post('/', async (req, res) => {
  try {
    const { error, value } = createEventSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }

    const { title, description, startDate, endDate, allDay, type, workspaceId, metadata } = value;

    // Verify workspace access
    const member = await prisma.workspaceMember.findUnique({
      where: {
        workspaceId_userId: {
          workspaceId,
          userId: req.user.id
        }
      }
    });

    if (!member || member.status !== 'ACTIVE') {
      return res.status(403).json({ error: 'Access denied to workspace' });
    }

    const event = await prisma.calendarEvent.create({
      data: {
        title,
        description,
        startDate: new Date(startDate),
        endDate: new Date(endDate),
        allDay,
        type,
        workspaceId,
        metadata
      }
    });

    res.status(201).json({ event });
  } catch (error) {
    console.error('Create event error:', error);
    res.status(500).json({ error: 'Failed to create calendar event' });
  }
});

// Update calendar event
router.put('/:eventId', async (req, res) => {
  try {
    const { eventId } = req.params;
    const { title, description, startDate, endDate, allDay, status, metadata } = req.body;
    
    const event = await prisma.calendarEvent.findUnique({
      where: { id: eventId }
    });

    if (!event) {
      return res.status(404).json({ error: 'Event not found' });
    }

    // Check workspace access
    const member = await prisma.workspaceMember.findUnique({
      where: {
        workspaceId_userId: {
          workspaceId: event.workspaceId,
          userId: req.user.id
        }
      }
    });

    if (!member || !['OWNER', 'ADMIN', 'EDITOR'].includes(member.role)) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }

    const updatedEvent = await prisma.calendarEvent.update({
      where: { id: eventId },
      data: {
        ...(title !== undefined && { title }),
        ...(description !== undefined && { description }),
        ...(startDate !== undefined && { startDate: new Date(startDate) }),
        ...(endDate !== undefined && { endDate: new Date(endDate) }),
        ...(allDay !== undefined && { allDay }),
        ...(status !== undefined && { status }),
        ...(metadata !== undefined && { metadata })
      }
    });

    res.json({ event: updatedEvent });
  } catch (error) {
    console.error('Update event error:', error);
    res.status(500).json({ error: 'Failed to update calendar event' });
  }
});

// Delete calendar event
router.delete('/:eventId', async (req, res) => {
  try {
    const { eventId } = req.params;
    
    const event = await prisma.calendarEvent.findUnique({
      where: { id: eventId }
    });

    if (!event) {
      return res.status(404).json({ error: 'Event not found' });
    }

    // Check workspace access
    const member = await prisma.workspaceMember.findUnique({
      where: {
        workspaceId_userId: {
          workspaceId: event.workspaceId,
          userId: req.user.id
        }
      }
    });

    if (!member || !['OWNER', 'ADMIN', 'EDITOR'].includes(member.role)) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }

    await prisma.calendarEvent.delete({
      where: { id: eventId }
    });

    res.json({ message: 'Calendar event deleted successfully' });
  } catch (error) {
    console.error('Delete event error:', error);
    res.status(500).json({ error: 'Failed to delete calendar event' });
  }
});

// Get upcoming events
router.get('/workspace/:workspaceId/upcoming', validateWorkspaceAccess, async (req, res) => {
  try {
    const { workspaceId } = req.params;
    const { limit = 10 } = req.query;
    
    const events = await prisma.calendarEvent.findMany({
      where: {
        workspaceId,
        startDate: { gte: new Date() },
        status: { not: 'CANCELLED' }
      },
      orderBy: { startDate: 'asc' },
      take: parseInt(limit)
    });

    res.json({ events });
  } catch (error) {
    console.error('Get upcoming events error:', error);
    res.status(500).json({ error: 'Failed to fetch upcoming events' });
  }
});

export default router;