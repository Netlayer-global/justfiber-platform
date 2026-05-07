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
    final bubbleColor = isUser ? kPrimary.withValues(alpha: 0.2) : kSurface;
    final borderColor = isUser ? kPrimary.withValues(alpha: 0.4) : kBorder;
    final radius = BorderRadius.only(
      topLeft: const Radius.circular(18),
      topRight: const Radius.circular(18),
      bottomLeft: Radius.circular(isUser ? 18 : 4),
      bottomRight: Radius.circular(isUser ? 4 : 18),
    );

    return Padding(
      padding: const EdgeInsets.only(bottom: 16),
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
                const SizedBox(width: 8),
              ],
              Flexible(
                child: Container(
                  padding:
                      const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                  decoration: BoxDecoration(
                    color: bubbleColor,
                    borderRadius: radius,
                    border: Border.all(color: borderColor),
                  ),
                  child: Text(
                    message.text,
                    style: GoogleFonts.inter(
                        color: Colors.white, height: 1.45, fontSize: 13),
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 4),
          Padding(
            padding:
                EdgeInsets.only(left: isUser ? 0 : 44, right: isUser ? 4 : 0),
            child: Text(
              timeLabel,
              style: GoogleFonts.inter(color: kMuted, fontSize: 10),
            ),
          ),
          if (message.actions.isNotEmpty) ...[
            const SizedBox(height: 8),
            Padding(
              padding: const EdgeInsets.only(left: 44),
              child: Wrap(
                spacing: 8,
                runSpacing: 8,
                children:
                    message.actions.map((a) => _ActionBtn(action: a)).toList(),
              ),
            ),
          ],
          if (message.meta.isNotEmpty) ...[
            const SizedBox(height: 8),
            Padding(
              padding: const EdgeInsets.only(left: 44),
              child: Wrap(
                spacing: 6,
                runSpacing: 6,
                children:
                    message.meta.map((m) => _MetaChip(item: m)).toList(),
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
          color: kPrimary.withValues(alpha: 0.1),
          borderRadius: BorderRadius.circular(11),
          border: Border.all(color: kPrimary.withValues(alpha: 0.2)),
        ),
        child: const Icon(Icons.support_agent_rounded,
            color: kPrimaryLight, size: 17),
      );
}

class _ActionBtn extends StatelessWidget {
  const _ActionBtn({required this.action});
  final ChatAction action;

  @override
  Widget build(BuildContext context) => GestureDetector(
        onTap: action.onTap,
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
          decoration: BoxDecoration(
            color: action.primary ? kPrimary : kSurface,
            borderRadius: BorderRadius.circular(12),
            border: Border.all(color: action.primary ? kPrimary : kBorder),
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

  @override
  Widget build(BuildContext context) => Container(
        padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 5),
        decoration: BoxDecoration(
          color: kPrimary.withValues(alpha: 0.1),
          borderRadius: BorderRadius.circular(999),
          border: Border.all(color: kPrimary.withValues(alpha: 0.2)),
        ),
        child: Text(
          '${item.label}: ${item.value}',
          style: GoogleFonts.inter(
              color: kPrimaryLight,
              fontWeight: FontWeight.w600,
              fontSize: 11),
        ),
      );
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
