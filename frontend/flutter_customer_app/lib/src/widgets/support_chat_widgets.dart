import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

import '../core/models.dart';
import '../core/theme.dart';

/// Models for the support assistant chat. Kept simple value types so the
/// `SupportAssistantScreen` can build them inline.
class ChatMessage {
  ChatMessage({
    required this.text,
    required this.isUser,
    this.actions = const [],
    this.meta = const [],
  });

  factory ChatMessage.user(String text) =>
      ChatMessage(text: text, isUser: true);
  factory ChatMessage.bot(
    String text, {
    List<ChatAction> actions = const [],
    List<ChatMetaChip> meta = const [],
  }) =>
      ChatMessage(text: text, isUser: false, actions: actions, meta: meta);

  final String text;
  final bool isUser;
  final List<ChatAction> actions;
  final List<ChatMetaChip> meta;
}

class ChatAction {
  const ChatAction({
    required this.label,
    required this.onTap,
    this.primary = false,
  });
  final String label;
  final VoidCallback onTap;
  final bool primary;
}

class ChatMetaChip {
  const ChatMetaChip({required this.label, required this.value});
  final String label;
  final String value;
}

// ── Chat bubble ──────────────────────────────────────────────────────────────

class ChatBubble extends StatelessWidget {
  const ChatBubble({
    super.key,
    required this.message,
    required this.timeLabel,
  });

  final ChatMessage message;
  final String timeLabel;

  @override
  Widget build(BuildContext context) {
    final isUser = message.isUser;

    return Padding(
      padding: const EdgeInsets.only(bottom: 18),
      child: Column(
        crossAxisAlignment:
            isUser ? CrossAxisAlignment.end : CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment:
                isUser ? MainAxisAlignment.end : MainAxisAlignment.start,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              if (!isUser) ...[
                const _BotAvatar(),
                const SizedBox(width: 10),
              ],
              Flexible(
                child: Container(
                  padding:
                      const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
                  decoration: BoxDecoration(
                    gradient: isUser
                        ? const LinearGradient(
                            colors: [Color(0xFF7C3AED), Color(0xFF6D28D9)],
                            begin: Alignment.topLeft,
                            end: Alignment.bottomRight,
                          )
                        : null,
                    color: isUser ? null : const Color(0xFF1A1A2E),
                    borderRadius: BorderRadius.only(
                      topLeft: const Radius.circular(20),
                      topRight: const Radius.circular(20),
                      bottomLeft: Radius.circular(isUser ? 20 : 4),
                      bottomRight: Radius.circular(isUser ? 4 : 20),
                    ),
                    border: isUser
                        ? null
                        : Border.all(
                            color: Colors.white.withValues(alpha: 0.06)),
                    boxShadow: [
                      BoxShadow(
                        color: isUser
                            ? const Color(0xFF7C3AED).withValues(alpha: 0.2)
                            : Colors.black.withValues(alpha: 0.15),
                        blurRadius: 8,
                        offset: const Offset(0, 3),
                      ),
                    ],
                  ),
                  child: Text(
                    message.text,
                    style: GoogleFonts.inter(
                      color: Colors.white.withValues(alpha: 0.95),
                      height: 1.5,
                      fontSize: 13.5,
                      fontWeight: FontWeight.w500,
                    ),
                  ),
                ),
              ),
              if (isUser) const SizedBox(width: 8),
            ],
          ),
          const SizedBox(height: 5),
          Padding(
            padding:
                EdgeInsets.only(left: isUser ? 0 : 46, right: isUser ? 4 : 0),
            child: Text(
              timeLabel,
              style: GoogleFonts.inter(
                  color: Colors.white.withValues(alpha: 0.3), fontSize: 10),
            ),
          ),
          if (message.meta.isNotEmpty) ...[
            const SizedBox(height: 10),
            Padding(
              padding: const EdgeInsets.only(left: 46),
              child: Wrap(
                spacing: 6,
                runSpacing: 6,
                children:
                    message.meta.map((m) => _MetaChip(item: m)).toList(),
              ),
            ),
          ],
          if (message.actions.isNotEmpty) ...[
            const SizedBox(height: 10),
            Padding(
              padding: const EdgeInsets.only(left: 46),
              child: Wrap(
                spacing: 8,
                runSpacing: 8,
                children:
                    message.actions.map((a) => _ActionBtn(action: a)).toList(),
              ),
            ),
          ],
        ],
      ),
    );
  }
}

class _BotAvatar extends StatelessWidget {
  const _BotAvatar();

  @override
  Widget build(BuildContext context) => Container(
        width: 36,
        height: 36,
        decoration: BoxDecoration(
          gradient: const LinearGradient(
            colors: [Color(0xFF7C3AED), Color(0xFF9333EA)],
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
          ),
          borderRadius: BorderRadius.circular(12),
          boxShadow: [
            BoxShadow(
              color: const Color(0xFF7C3AED).withValues(alpha: 0.3),
              blurRadius: 8,
              offset: const Offset(0, 2),
            ),
          ],
        ),
        child: const Icon(Icons.support_agent_rounded,
            color: Colors.white, size: 18),
      );
}

class _ActionBtn extends StatelessWidget {
  const _ActionBtn({required this.action});
  final ChatAction action;

  @override
  Widget build(BuildContext context) => GestureDetector(
        onTap: action.onTap,
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
          decoration: BoxDecoration(
            gradient: action.primary
                ? const LinearGradient(
                    colors: [Color(0xFF7C3AED), Color(0xFF9333EA)],
                    begin: Alignment.centerLeft,
                    end: Alignment.centerRight,
                  )
                : null,
            color: action.primary ? null : const Color(0xFF1A1A2E),
            borderRadius: BorderRadius.circular(12),
            border: action.primary
                ? null
                : Border.all(color: Colors.white.withValues(alpha: 0.1)),
            boxShadow: action.primary
                ? [
                    BoxShadow(
                      color: const Color(0xFF7C3AED).withValues(alpha: 0.3),
                      blurRadius: 8,
                      offset: const Offset(0, 3),
                    ),
                  ]
                : null,
          ),
          child: Text(action.label,
              style: GoogleFonts.inter(
                  color: Colors.white,
                  fontWeight: FontWeight.w700,
                  fontSize: 12)),
        ),
      );
}

class _MetaChip extends StatelessWidget {
  const _MetaChip({required this.item});
  final ChatMetaChip item;

  Color _chipColor() {
    final v = item.value.toLowerCase();
    if (v.contains('online') || v.contains('healthy') || v.contains('good') || v.contains('active')) {
      return const Color(0xFF10B981);
    }
    if (v.contains('offline') || v.contains('down') || v.contains('poor') || v.contains('critical')) {
      return const Color(0xFFEF4444);
    }
    if (v.contains('degraded') || v.contains('weak') || v.contains('slow')) {
      return const Color(0xFFF59E0B);
    }
    return const Color(0xFF8B5CF6);
  }

  @override
  Widget build(BuildContext context) {
    final color = _chipColor();
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.12),
        borderRadius: BorderRadius.circular(999),
        border: Border.all(color: color.withValues(alpha: 0.25)),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Container(
            width: 6,
            height: 6,
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              color: color,
            ),
          ),
          const SizedBox(width: 6),
          Text(
            '${item.label}: ${item.value}',
            style: GoogleFonts.inter(
                color: color,
                fontWeight: FontWeight.w700,
                fontSize: 11),
          ),
        ],
      ),
    );
  }
}

// ── Typing indicator ─────────────────────────────────────────────────────────

class TypingBubble extends StatelessWidget {
  const TypingBubble({super.key});

  @override
  Widget build(BuildContext context) => Padding(
        padding: const EdgeInsets.only(bottom: 16),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const _BotAvatar(),
            const SizedBox(width: 8),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 14),
              decoration: BoxDecoration(
                color: kSurface,
                borderRadius: const BorderRadius.only(
                  topLeft: Radius.circular(18),
                  topRight: Radius.circular(18),
                  bottomLeft: Radius.circular(4),
                  bottomRight: Radius.circular(18),
                ),
                border: Border.all(color: kBorder),
              ),
              child: const SizedBox(
                width: 44,
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [_TypingDot(), _TypingDot(), _TypingDot()],
                ),
              ),
            ),
          ],
        ),
      );
}

class _TypingDot extends StatelessWidget {
  const _TypingDot();

  @override
  Widget build(BuildContext context) => Container(
        width: 7,
        height: 7,
        decoration: const BoxDecoration(
          color: kMuted,
          shape: BoxShape.circle,
        ),
      );
}

// ── Connection / Ticket context cards ────────────────────────────────────────

class ConnectionContextCard extends StatelessWidget {
  const ConnectionContextCard({super.key, required this.connection});
  final CustomerConnection connection;

  @override
  Widget build(BuildContext context) => Padding(
        padding: const EdgeInsets.only(bottom: 16),
        child: Container(
          width: double.infinity,
          padding: const EdgeInsets.all(14),
          decoration: BoxDecoration(
            color: kSurface,
            borderRadius: BorderRadius.circular(18),
            border: Border.all(color: kBorder),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text('ACTIVE CONNECTION',
                  style: GoogleFonts.inter(
                      color: kPrimaryLight,
                      fontWeight: FontWeight.w800,
                      letterSpacing: 1.6,
                      fontSize: 10)),
              const SizedBox(height: 8),
              Text(
                connection.planName.isEmpty
                    ? 'Broadband connection'
                    : connection.planName,
                style: GoogleFonts.inter(
                    color: Colors.white,
                    fontWeight: FontWeight.w800,
                    fontSize: 15),
              ),
              const SizedBox(height: 4),
              Text(
                connection.address.isEmpty
                    ? connection.serviceId
                    : connection.address,
                style: GoogleFonts.inter(
                    color: kMuted, fontSize: 12, height: 1.4),
              ),
              const SizedBox(height: 10),
              Wrap(spacing: 6, runSpacing: 6, children: [
                _ContextPill(
                    label: 'Service',
                    value: connection.serviceId.isEmpty
                        ? connection.customerId
                        : connection.serviceId),
                _ContextPill(
                    label: 'Status',
                    value:
                        connection.status.isEmpty ? '-' : connection.status),
                _ContextPill(
                    label: 'Online',
                    value: connection.onlineStatus.isEmpty
                        ? 'unknown'
                        : connection.onlineStatus),
                _ContextPill(
                    label: 'Due',
                    value: connection.dueAmount > 0
                        ? 'Rs ${connection.dueAmount.toStringAsFixed(0)}'
                        : 'clear'),
              ]),
            ],
          ),
        ),
      );
}

class TicketContextCard extends StatelessWidget {
  const TicketContextCard({super.key, required this.ticket});
  final SupportTicketItem ticket;

  Color _statusColor(String status) {
    final n = status.toLowerCase();
    if (n.contains('closed') ||
        n.contains('resolved') ||
        n.contains('done')) {
      return const Color(0xFF22C55E);
    }
    if (n.contains('open') ||
        n.contains('pending') ||
        n.contains('progress')) {
      return const Color(0xFFF59E0B);
    }
    return kPrimaryLight;
  }

  @override
  Widget build(BuildContext context) {
    final statusColor = _statusColor(ticket.status);
    return Padding(
      padding: const EdgeInsets.only(bottom: 16),
      child: Container(
        width: double.infinity,
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(
          color: kSurface,
          borderRadius: BorderRadius.circular(18),
          border: Border.all(color: kBorder),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text('LATEST TICKET',
                style: GoogleFonts.inter(
                    color: kPrimaryLight,
                    fontWeight: FontWeight.w800,
                    letterSpacing: 1.6,
                    fontSize: 10)),
            const SizedBox(height: 8),
            Row(
              children: [
                Expanded(
                  child: Text(ticket.ticketNumber,
                      style: GoogleFonts.inter(
                          color: Colors.white,
                          fontWeight: FontWeight.w800,
                          fontSize: 15)),
                ),
                Container(
                  padding: const EdgeInsets.symmetric(
                      horizontal: 10, vertical: 5),
                  decoration: BoxDecoration(
                    color: statusColor.withValues(alpha: 0.1),
                    borderRadius: BorderRadius.circular(999),
                    border: Border.all(
                        color: statusColor.withValues(alpha: 0.3)),
                  ),
                  child: Text(ticket.status,
                      style: GoogleFonts.inter(
                          color: statusColor,
                          fontWeight: FontWeight.w700,
                          fontSize: 11)),
                ),
              ],
            ),
            const SizedBox(height: 4),
            Text(ticket.subject,
                style: GoogleFonts.inter(
                    color: kMuted, fontSize: 12, height: 1.4)),
            if (ticket.latestUpdateNote.isNotEmpty) ...[
              const SizedBox(height: 8),
              Container(
                width: double.infinity,
                padding: const EdgeInsets.all(10),
                decoration: BoxDecoration(
                  color: kBg,
                  borderRadius: BorderRadius.circular(10),
                  border: Border.all(color: kBorder),
                ),
                child: Text('Latest: ${ticket.latestUpdateNote}',
                    style: GoogleFonts.inter(
                        color: kMuted, height: 1.4, fontSize: 11)),
              ),
            ],
            const SizedBox(height: 10),
            Wrap(spacing: 6, runSpacing: 6, children: [
              _ContextPill(label: 'Priority', value: ticket.priority),
              _ContextPill(label: 'Category', value: ticket.category),
              if (ticket.createdAt.isNotEmpty)
                _ContextPill(label: 'Opened', value: ticket.createdAt),
            ]),
          ],
        ),
      ),
    );
  }
}

class _ContextPill extends StatelessWidget {
  const _ContextPill({required this.label, required this.value});
  final String label, value;

  @override
  Widget build(BuildContext context) => Container(
        padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 5),
        decoration: BoxDecoration(
          color: kBg,
          borderRadius: BorderRadius.circular(8),
          border: Border.all(color: kBorder),
        ),
        child: Text('$label: $value',
            style: GoogleFonts.inter(
                color: Colors.white,
                fontWeight: FontWeight.w600,
                fontSize: 10)),
      );
}
