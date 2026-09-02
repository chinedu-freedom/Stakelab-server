import { prisma } from '../config/db.js';
import { sendEmail, sendAdminNotificationEmail } from '../services/emailService.js';

export const createTicket = async (req, res) => {
  try {
    const { subject, priority, message } = req.body;
    const userId = req.user.id;

    if (!subject || !message) {
      return res.status(400).json({ success: false, message: 'Subject and message are required' });
    }

    const user = await prisma.users.findUnique({ where: { id: userId } });
    const ticketId = '#' + Math.floor(100000 + Math.random() * 900000).toString();

    const ticket = await prisma.support_tickets.create({
      data: {
        ticket_id: ticketId,
        user_id: userId,
        subject,
        priority: priority || 'Medium',
        status: 'OPEN',
        messages: {
          create: {
            sender_type: 'USER',
            sender_name: user.full_name || user.username || 'User',
            message,
          },
        },
      },
      include: {
        messages: true,
      },
    });

    sendAdminNotificationEmail({
      subject: `New Support Ticket ${ticketId}: ${subject}`,
      title: 'New Support Ticket Created',
      details: `<p>A user created a new support ticket:</p><ul><li><b>Ticket ID:</b> ${ticketId}</li><li><b>User:</b> @${user.username || user.full_name} (${user.email})</li><li><b>Subject:</b> ${subject}</li><li><b>Priority:</b> ${priority || 'Medium'}</li><li><b>Message:</b> ${message}</li></ul>`,
    }).catch(() => null);

    return res.status(201).json({
      success: true,
      message: 'Support ticket created successfully',
      ticket,
    });
  } catch (error) {
    console.error('Create ticket error:', error);
    return res.status(500).json({ success: false, message: 'Failed to create ticket', error: error.message });
  }
};

export const getUserTickets = async (req, res) => {
  try {
    const tickets = await prisma.support_tickets.findMany({
      where: { user_id: req.user.id },
      include: {
        messages: {
          orderBy: { created_at: 'desc' },
          take: 1,
        },
      },
      orderBy: { updated_at: 'desc' },
    });

    return res.json({ success: true, tickets });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Failed to fetch tickets', error: error.message });
  }
};

export const getTicketById = async (req, res) => {
  try {
    const { id } = req.params;
    const isUuid = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(id);

    const ticket = await prisma.support_tickets.findFirst({
      where: {
        OR: [
          ...(isUuid ? [{ id }] : []),
          { ticket_id: id.startsWith('#') ? id : `#${id}` },
          { ticket_id: id },
          { ticket_id: id.replace(/^#/, '') },
        ],
      },
      include: {
        user: {
          select: { id: true, full_name: true, email: true, username: true, profile_image: true },
        },
        messages: {
          orderBy: { created_at: 'asc' },
        },
      },
    });

    if (!ticket) {
      return res.status(404).json({ success: false, message: 'Ticket not found' });
    }

    return res.json({ success: true, ticket });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Failed to fetch ticket', error: error.message });
  }
};

export const replyTicket = async (req, res) => {
  try {
    const { id } = req.params;
    const { message, reply_to_id, reply_to_name, reply_to_text, attachments } = req.body;
    const isAdmin = !!req.admin;

    let dynamicSiteName = 'EverStake';
    const siteSettings = await prisma.settings.findFirst();
    if (siteSettings?.site_name) {
      dynamicSiteName = siteSettings.site_name;
    }

    const defaultAdminName = `${dynamicSiteName} Admin`;
    const senderName = isAdmin 
      ? (req.admin?.username || defaultAdminName) 
      : (req.user?.full_name || req.user?.username || 'User');
    const senderType = isAdmin ? 'ADMIN' : 'USER';

    if (!message) {
      return res.status(400).json({ success: false, message: 'Message text is required' });
    }

    const isUuid = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(id);

    const ticket = await prisma.support_tickets.findFirst({
      where: {
        OR: [
          ...(isUuid ? [{ id }] : []),
          { ticket_id: id.startsWith('#') ? id : `#${id}` },
          { ticket_id: id },
          { ticket_id: id.replace(/^#/, '') },
        ],
      },
    });

    if (!ticket) {
      return res.status(404).json({ success: false, message: 'Ticket not found' });
    }

    const formattedAttachments = attachments
      ? (typeof attachments === 'string' ? attachments : JSON.stringify(attachments))
      : null;

    const newMessage = await prisma.ticket_messages.create({
      data: {
        ticket_id: ticket.id,
        sender_type: senderType,
        sender_name: senderName,
        message,
        attachments: formattedAttachments,
        ...(reply_to_id && { reply_to_id }),
        ...(reply_to_name && { reply_to_name }),
        ...(reply_to_text && { reply_to_text }),
      },
    });

    await prisma.support_tickets.update({
      where: { id: ticket.id },
      data: {
        status: isAdmin ? 'REPLIED' : 'OPEN',
        updated_at: new Date(),
      },
    });

    // Notify ticket recipient
    try {
      const ticketUser = await prisma.users.findUnique({ where: { id: ticket.user_id } });
      if (isAdmin && ticketUser?.email) {
        // Send email to user notifying them of admin reply
        sendEmail({
          to: ticketUser.email,
          subject: `💬 New Reply on Support Ticket ${ticket.ticket_id || ''}`,
          html: `
            <div style="font-family: sans-serif; padding: 20px; color: #0f172a; max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 8px; border: 1px solid #e2e8f0;">
              <h2 style="color: #5b5bf5; font-size: 18px; margin-top: 0; margin-bottom: 12px; border-bottom: 2px solid #5b5bf5; padding-bottom: 8px;">New Support Reply</h2>
              <p>Hi <b>${ticketUser.full_name || ticketUser.username || 'Valued User'}</b>,</p>
              <p>Our support team has posted a reply to your support ticket <b>${ticket.ticket_id || ''} (${ticket.subject})</b>:</p>
              <div style="background: #f8fafc; border-left: 4px solid #5b5bf5; padding: 14px; margin: 16px 0; font-size: 14px; color: #334155; border-radius: 4px; line-height: 1.6;">
                ${message.replace(/\n/g, '<br/>')}
              </div>
              <p style="font-size: 13px; color: #64748b;">Log in to your ${dynamicSiteName} dashboard to view the full ticket thread and reply.</p>
            </div>
          `,
          emailType: 'SUPPORT_TICKET_REPLY',
          userId: ticketUser.id,
        }).catch((err) => console.error('Ticket user reply email error:', err));
      } else if (!isAdmin) {
        // Send email alert to admin notifying them of user reply
        sendAdminNotificationEmail({
          subject: `User Reply on Support Ticket ${ticket.ticket_id || ''}: ${ticket.subject}`,
          title: 'Support Ticket User Reply',
          details: `<p><b>User:</b> @${senderName}</p><p><b>Ticket ID:</b> ${ticket.ticket_id || ''}</p><p><b>Subject:</b> ${ticket.subject}</p><p><b>Message:</b></p><blockquote>${message}</blockquote>`,
        }).catch(() => null);
      }
    } catch (notifyErr) {
      console.error('Ticket reply notification dispatch error:', notifyErr);
    }

    return res.json({ success: true, message: 'Reply sent successfully', reply: newMessage });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Failed to reply to ticket', error: error.message });
  }
};

export const getAdminTickets = async (req, res) => {
  try {
    const { status } = req.query;

    const where = {};
    if (status && status !== 'ALL') {
      where.status = status;
    }

    const tickets = await prisma.support_tickets.findMany({
      where,
      include: {
        user: {
          select: { id: true, full_name: true, email: true, username: true },
        },
        messages: {
          orderBy: { created_at: 'desc' },
          take: 1,
        },
      },
      orderBy: { updated_at: 'desc' },
    });

    return res.json({ success: true, tickets });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Failed to fetch admin tickets', error: error.message });
  }
};

export const closeTicket = async (req, res) => {
  try {
    const { id } = req.params;
    const isUuid = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(id);

    const ticket = await prisma.support_tickets.findFirst({
      where: {
        OR: [
          ...(isUuid ? [{ id }] : []),
          { ticket_id: id.startsWith('#') ? id : `#${id}` },
          { ticket_id: id },
          { ticket_id: id.replace(/^#/, '') },
        ],
      },
    });

    if (!ticket) {
      return res.status(404).json({ success: false, message: 'Ticket not found' });
    }

    await prisma.support_tickets.update({
      where: { id: ticket.id },
      data: { status: 'CLOSED' },
    });

    return res.json({ success: true, message: 'Ticket closed successfully' });
  } catch (error) {
    console.error('Close ticket error:', error);
    return res.status(500).json({ success: false, message: 'Failed to close ticket', error: error.message });
  }
};

export const deleteTicketMessage = async (req, res) => {
  try {
    const { id } = req.params;
    await prisma.ticket_messages.delete({
      where: { id },
    });
    return res.json({ success: true, message: 'Message deleted successfully' });
  } catch (error) {
    console.error('Delete message error:', error);
    return res.status(500).json({ success: false, message: 'Failed to delete message', error: error.message });
  }
};

export const reopenTicket = async (req, res) => {
  try {
    const { id } = req.params;
    const isUuid = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(id);

    const ticket = await prisma.support_tickets.findFirst({
      where: {
        OR: [
          ...(isUuid ? [{ id }] : []),
          { ticket_id: id.startsWith('#') ? id : `#${id}` },
          { ticket_id: id },
          { ticket_id: id.replace(/^#/, '') },
        ],
      },
    });

    if (!ticket) {
      return res.status(404).json({ success: false, message: 'Ticket not found' });
    }

    await prisma.support_tickets.update({
      where: { id: ticket.id },
      data: { status: 'OPEN' },
    });

    return res.json({ success: true, message: 'Ticket reopened successfully' });
  } catch (error) {
    console.error('Reopen ticket error:', error);
    return res.status(500).json({ success: false, message: 'Failed to reopen ticket', error: error.message });
  }
};
