import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

import '../core/app_state.dart';
import '../core/models.dart';
import '../core/theme.dart';
import 'billing_history_screen.dart';
import 'plan_catalog_screen.dart';

class SupportAssistantScreen extends StatefulWidget {
  const SupportAssistantScreen({super.key, this.issueType = 'general'});
  final String issueType;

  @override
  State<SupportAssistantScreen> createState() => _SupportAssistantScreenState();
}

class _SupportAssistantScreenState extends State<SupportAssistantScreen> {
  final TextEditingController _controller = TextEditingController();
  final ScrollController _scrollController = ScrollController();
  final List<_ChatMessage> _messages = [];

  SupportDiagnosis? _lastDiagnosis;
  SupportTicketItem? _latestTicket;
  bool _loading = false;
  bool _raisingTicket = false;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) return;
      _seedConversation();
    });
  }

  @override
  void dispose() {
    _controller.dispose();
    _scrollController.dispose();
    super.dispose();
  }

  void _seedConversation() {
    if (_messages.isNotEmpty) return;
    final prompt = _defaultPromptFor(widget.issueType);
    final appState = AppStateScope.of(context);
    _latestTicket = appState.tickets.isNotEmpty ? appState.tickets.first : null;
    setState(() {
      _messages.add(_ChatMessage.bot(
          'We are here to help you out. Tell me what is happening with your connection, billing, Wi-Fi, or speed.'));
      _messages.add(_ChatMessage.bot(
          'You can type things like: internet not working, Wi-Fi problem, slow speed, bill issue, or plan issue.'));
      if (_latestTicket != null) {
        _messages.add(_ChatMessage.bot(
            'Your latest support case is ${_latestTicket!.ticketNumber} with status ${_latestTicket!.status}. If this is about the same issue, type still not resolved.'));
      }
      if (widget.issueType != 'general') {
        _messages.add(_ChatMessage.user(prompt));
      }
    });
    _scrollToBottom();
    if (widget.issueType != 'general') {
      _sendUserIntent(prompt, issueTypeOverride: widget.issueType);
    }
  }

  String _defaultPromptFor(String issueType) {
    switch (issueType) {
      case 'billing':
        return 'I have a billing issue';
      case 'plan':
        return 'I have a plan issue';
      case 'wifi':
        return 'I have a Wi-Fi issue';
      case 'speed':
        return 'My internet speed is slow';
      case 'internet':
        return 'I have an internet issue';
      default:
        return 'I need help';
    }
  }

  String _inferIssueType(String text) {
    final q = text.toLowerCase();
    if (q.contains('bill') ||
        q.contains('due') ||
        q.contains('payment') ||
        q.contains('recharge')) {
      return 'billing';
    }
    if (q.contains('wifi') ||
        q.contains('wi-fi') ||
        q.contains('ssid') ||
        q.contains('router') ||
        q.contains('password')) {
      return 'wifi';
    }
    if (q.contains('slow') ||
        q.contains('speed') ||
        q.contains('latency') ||
        q.contains('ping')) {
      return 'speed';
    }
    if (q.contains('plan') ||
        q.contains('fup') ||
        q.contains('data') ||
        q.contains('upgrade') ||
        q.contains('cap')) {
      return 'plan';
    }
    return 'internet';
  }

  bool _isFollowUpIntent(String text) {
    final q = text.toLowerCase();
    return q.contains('still') ||
        q.contains('not resolved') ||
        q.contains('not fixed') ||
        q.contains('same issue') ||
        q.contains('continue') ||
        q.contains('proceed') ||
        q == 'yes' ||
        q.contains('agent') ||
        q.contains('human');
  }

  bool _handleContextualReply(String text) {
    final diagnosis = _lastDiagnosis;
    if (diagnosis == null) return false;
    final q = text.toLowerCase();
    if (q.contains('agent') || q.contains('human')) {
      setState(() {
        _messages.add(_ChatMessage.bot(
          'I can prepare the full diagnostic snapshot and hand this over as a complaint for the support team.',
          actions: [
            _ChatAction(
                label: 'Raise complaint', onTap: _raiseComplaint, primary: true)
          ],
        ));
      });
      _scrollToBottom();
      return true;
    }
    if (_isFollowUpIntent(text)) {
      setState(() {
        _messages.add(_ChatMessage.bot(
          diagnosis.needsTicket
              ? 'This still looks like a service-side issue from our checks. The fastest next step is to raise a complaint so the support team can act on the diagnosis directly.'
              : 'I can run the checks again for you, or I can raise a complaint if you want a manual investigation.',
          actions: [
            if (diagnosis.needsTicket)
              _ChatAction(
                  label: 'Raise complaint',
                  onTap: _raiseComplaint,
                  primary: true)
            else
              _ChatAction(
                label: 'Check again',
                onTap: () => _sendUserIntent('Please check my issue again',
                    issueTypeOverride: diagnosis.issueType),
                primary: true,
              ),
            if (!diagnosis.needsTicket)
              _ChatAction(label: 'Raise complaint', onTap: _raiseComplaint),
          ],
        ));
      });
      _scrollToBottom();
      return true;
    }
    return false;
  }

  Future<void> _sendUserIntent(String text, {String? issueTypeOverride}) async {
    final appState = AppStateScope.of(context);
    final session = appState.session;
    if (session == null) {
      setState(() {
        _messages.add(_ChatMessage.bot(
            'Please login again so I can check your account and connection health.'));
      });
      return;
    }
    final issueType = issueTypeOverride ?? _inferIssueType(text);
    setState(() => _loading = true);
    _scrollToBottom();
    try {
      final diagnosis = await appState.api.fetchSupportDiagnosis(
        session,
        customerId: appState.selectedCustomerId,
        issueType: issueType,
      );
      if (!mounted) return;
      final actions = _actionsForDiagnosis(diagnosis);
      setState(() {
        _lastDiagnosis = diagnosis;
        _loading = false;
        _messages.add(_ChatMessage.bot(
          '${_humanHeadline(diagnosis)}\n\n${diagnosis.summary}',
          actions: actions,
          meta: [
            _ChatMetaChip(label: 'Internet', value: diagnosis.internetStatus),
            _ChatMetaChip(label: 'Wi-Fi', value: diagnosis.wifiStatus),
            _ChatMetaChip(label: 'Line', value: diagnosis.lineStatus),
          ],
        ));
        _messages.add(_ChatMessage.bot(_diagnosisSnapshotText(diagnosis)));
        if (diagnosis.steps.isNotEmpty) {
          _messages.add(_ChatMessage.bot(
            diagnosis.steps
                .asMap()
                .entries
                .map((e) => '${e.key + 1}. ${e.value}')
                .join('\n'),
          ));
        }
      });
      _scrollToBottom();
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _loading = false;
        _messages.add(_ChatMessage.bot(
          'I could not complete the checks right now. Please try again, or raise a complaint if the issue is urgent.',
          actions: [
            _ChatAction(
                label: 'Check again',
                onTap: () =>
                    _sendUserIntent(text, issueTypeOverride: issueType)),
            _ChatAction(label: 'Raise complaint', onTap: _raiseComplaint),
          ],
        ));
      });
      _scrollToBottom();
      ScaffoldMessenger.of(context)
          .showSnackBar(SnackBar(content: Text(e.toString())));
    }
  }

  List<_ChatAction> _actionsForDiagnosis(SupportDiagnosis diagnosis) {
    if (diagnosis.diagnosisCode == 'billing_suspended' ||
        diagnosis.diagnosisCode == 'payment_pending') {
      return [
        _ChatAction(label: 'Open billing', onTap: _openBilling, primary: true),
        _ChatAction(label: 'Raise complaint', onTap: _raiseComplaint),
      ];
    }
    if (diagnosis.diagnosisCode == 'data_limit_reached' ||
        diagnosis.diagnosisCode == 'fup_applied' ||
        diagnosis.diagnosisCode == 'speed_fup_limited' ||
        diagnosis.diagnosisCode == 'speed_hard_cap') {
      return [
        _ChatAction(label: 'Open plans', onTap: _openPlans, primary: true),
        _ChatAction(label: 'Raise complaint', onTap: _raiseComplaint),
      ];
    }
    if (diagnosis.needsTicket) {
      return [
        _ChatAction(
            label: 'Raise complaint', onTap: _raiseComplaint, primary: true),
        _ChatAction(
            label: 'Check again',
            onTap: () => _sendUserIntent('Please check my issue again',
                issueTypeOverride: diagnosis.issueType)),
      ];
    }
    return [
      _ChatAction(
          label: 'Check again',
          onTap: () => _sendUserIntent('Please check my issue again',
              issueTypeOverride: diagnosis.issueType),
          primary: true),
    ];
  }

  String _diagnosisSnapshotText(SupportDiagnosis diagnosis) {
    final opticalText = diagnosis.opticalRxPower == null
        ? '-'
        : '${diagnosis.opticalRxPower!.toStringAsFixed(1)} dBm';
    return 'Recommended next step: ${diagnosis.recommendation}\n\n'
        'Live snapshot\n'
        '- Internet: ${diagnosis.internetStatus}\n'
        '- Wi-Fi: ${diagnosis.wifiStatus}\n'
        '- Line: ${diagnosis.lineStatus}\n'
        '- Estimated speed: ${diagnosis.estimatedSpeedMbps.toStringAsFixed(0)} Mbps\n'
        '- Latency: ${diagnosis.latencyMs.toStringAsFixed(0)} ms\n'
        '- Packet loss: ${diagnosis.packetLossPercent.toStringAsFixed(1)} %\n'
        '- Optical RX: $opticalText';
  }

  String _humanHeadline(SupportDiagnosis diagnosis) {
    switch (diagnosis.diagnosisCode) {
      case 'billing_suspended':
        return 'Your connection looks paused because there is a billing due on this account.';
      case 'payment_pending':
        return 'I can see a pending billing issue on this connection.';
      case 'data_limit_reached':
        return 'This connection has reached its current data limit.';
      case 'fup_applied':
        return 'Your connection is currently under reduced speed because FUP is active.';
      case 'device_offline':
      case 'speed_router_offline':
      case 'wifi_backhaul_down':
        return 'The router or line does not look fully online right now.';
      case 'degraded_link':
      case 'speed_below_expected':
        return 'I am seeing line or speed quality below the expected level.';
      case 'wifi_access_control':
        return 'This looks like a Wi-Fi device access issue rather than a full network outage.';
      case 'wifi_quality_weak':
        return 'The issue looks more like local Wi-Fi quality than a complete line failure.';
      case 'healthy_connection':
      case 'billing_clear':
      case 'plan_healthy':
      case 'speed_normal':
        return 'The connection checks mostly look healthy from our side.';
      default:
        return diagnosis.headline;
    }
  }

  Future<void> _openBilling() async {
    await Navigator.of(context)
        .push(MaterialPageRoute(builder: (_) => const BillingHistoryScreen()));
    if (!mounted) return;
    await AppStateScope.of(context).refresh();
  }

  Future<void> _openPlans() async {
    await Navigator.of(context)
        .push(MaterialPageRoute(builder: (_) => const PlanCatalogScreen()));
    if (!mounted) return;
    await AppStateScope.of(context).refresh();
  }

  Future<void> _raiseComplaint() async {
    final appState = AppStateScope.of(context);
    final diagnosis = _lastDiagnosis;
    if (diagnosis == null || _raisingTicket) return;
    setState(() => _raisingTicket = true);
    final subject = diagnosis.issueType == 'billing'
        ? 'Billing issue detected'
        : diagnosis.issueType == 'plan'
            ? 'Plan issue detected'
            : diagnosis.issueType == 'wifi'
                ? 'Wi-Fi issue detected'
                : diagnosis.issueType == 'speed'
                    ? 'Slow speed detected'
                    : 'Internet issue detected';
    final ticketNumber = await appState.raiseComplaint(
      category: diagnosis.issueType == 'billing' ? 'billing' : 'technical',
      subject: subject,
      description: '${diagnosis.headline}\n\n${diagnosis.summary}\n\n'
          'Recommendation: ${diagnosis.recommendation}\n\nSnapshot:\n'
          '- Issue type: ${diagnosis.issueType}\n'
          '- Internet: ${diagnosis.internetStatus}\n'
          '- Wi-Fi: ${diagnosis.wifiStatus}\n'
          '- Line: ${diagnosis.lineStatus}\n'
          '- Speed: ${diagnosis.estimatedSpeedMbps.toStringAsFixed(0)} Mbps\n'
          '- Latency: ${diagnosis.latencyMs.toStringAsFixed(0)} ms\n'
          '- Packet loss: ${diagnosis.packetLossPercent.toStringAsFixed(1)} %\n'
          '- Optical RX: ${diagnosis.opticalRxPower == null ? '-' : '${diagnosis.opticalRxPower!.toStringAsFixed(1)} dBm'}',
    );
    if (!mounted) return;
    setState(() {
      _raisingTicket = false;
      _messages.add(_ChatMessage.bot(
        ticketNumber != null
            ? 'Your complaint has been raised successfully. Reference: $ticketNumber'
            : (appState.error ??
                'I could not raise the complaint right now. Please try again shortly.'),
      ));
      if (ticketNumber != null) {
        _latestTicket = SupportTicketItem(
          id: '',
          ticketNumber: ticketNumber,
          category: diagnosis.issueType == 'billing' ? 'billing' : 'technical',
          subject: subject,
          description: diagnosis.summary,
          latestUpdateNote: 'Complaint created from support chat',
          latestUpdateAt: '',
          status: 'open',
          priority: diagnosis.needsTicket ? 'high' : 'normal',
          createdAt: '',
        );
        _messages.add(_ChatMessage.bot(
            'Our support team will now review your connection snapshot and continue the case from this reference. You can track updates from Support & requests.'));
        _messages.add(_ChatMessage.bot(
            'Complaint progress\n1. Complaint created\n2. Diagnostics attached\n3. Support review pending'));
      }
    });
    _scrollToBottom();
    if (ticketNumber != null) await appState.refresh();
  }

  void _submitComposer() {
    final text = _controller.text.trim();
    if (text.isEmpty || _loading) return;
    setState(() {
      _messages.add(_ChatMessage.user(text));
      _controller.clear();
    });
    _scrollToBottom();
    if (_handleContextualReply(text)) return;
    _sendUserIntent(text);
  }

  String _timeLabel() {
    final now = TimeOfDay.now();
    final hour = now.hourOfPeriod == 0 ? 12 : now.hourOfPeriod;
    final minute = now.minute.toString().padLeft(2, '0');
    final suffix = now.period == DayPeriod.am ? 'am' : 'pm';
    return '$hour:$minute $suffix';
  }

  void _scrollToBottom() {
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!_scrollController.hasClients) return;
      _scrollController.animateTo(
        _scrollController.position.maxScrollExtent + 120,
        duration: const Duration(milliseconds: 260),
        curve: Curves.easeOut,
      );
    });
  }

  @override
  Widget build(BuildContext context) {
    final appState = AppStateScope.of(context);
    CustomerConnection? selectedConnection;
    for (final item in appState.connections) {
      if (item.customerId == appState.selectedCustomerId) {
        selectedConnection = item;
        break;
      }
    }

    return Scaffold(
      backgroundColor: kBg,
      body: Column(
        children: [
          // ── Gradient header ──────────────────────────────────────────
          Container(
            decoration: const BoxDecoration(
              color: Color(0xFF8224E3),
            ),
            child: SafeArea(
              bottom: false,
              child: Padding(
                padding: const EdgeInsets.fromLTRB(4, 8, 16, 16),
                child: Row(
                  children: [
                    IconButton(
                      onPressed: () => Navigator.of(context).maybePop(),
                      icon: const Icon(Icons.arrow_back_ios_new_rounded,
                          color: Colors.white, size: 20),
                    ),
                    const SizedBox(width: 4),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text('JustFiber Chat',
                              style: GoogleFonts.inter(
                                  color: Colors.white,
                                  fontSize: 18,
                                  fontWeight: FontWeight.w900,
                                  letterSpacing: -0.3)),
                          Text('Get help 24×7',
                              style: GoogleFonts.inter(
                                  color: Colors.white60, fontSize: 12)),
                        ],
                      ),
                    ),
                    // Status chips
                    Wrap(
                      spacing: 6,
                      children: [
                        _headerChip(widget.issueType == 'general'
                            ? 'General'
                            : widget.issueType),
                        if (_lastDiagnosis != null)
                          _headerChip(_lastDiagnosis!.diagnosisCode),
                      ],
                    ),
                  ],
                ),
              ),
            ),
          ),

          // ── Chat area ────────────────────────────────────────────────
          Expanded(
            child: ListView.builder(
              controller: _scrollController,
              padding: const EdgeInsets.fromLTRB(16, 16, 16, 24),
              itemCount: (selectedConnection == null ? 0 : 1) +
                  (_latestTicket == null ? 0 : 1) +
                  _messages.length +
                  (_loading ? 1 : 0),
              itemBuilder: (context, index) {
                if (selectedConnection != null && index == 0) {
                  return _connectionCard(selectedConnection);
                }
                final ticketOffset = selectedConnection == null ? 0 : 1;
                if (_latestTicket != null && index == ticketOffset) {
                  return _ticketCard(_latestTicket!);
                }
                final msgIndex =
                    index - ticketOffset - (_latestTicket == null ? 0 : 1);
                if (_loading && msgIndex == _messages.length) {
                  return _typingBubble();
                }
                return _chatBubble(_messages[msgIndex]);
              },
            ),
          ),

          // ── Composer ─────────────────────────────────────────────────
          Container(
            padding: const EdgeInsets.fromLTRB(14, 10, 14, 14),
            decoration: const BoxDecoration(
              color: kSurface,
              border: Border(top: BorderSide(color: kBorder)),
            ),
            child: SafeArea(
              top: false,
              child: Row(
                children: [
                  Container(
                    width: 42,
                    height: 42,
                    decoration: BoxDecoration(
                      color: kPrimary.withValues(alpha: 0.1),
                      borderRadius: BorderRadius.circular(13),
                      border:
                          Border.all(color: kPrimary.withValues(alpha: 0.2)),
                    ),
                    child: const Icon(Icons.support_agent_rounded,
                        color: kPrimaryLight, size: 20),
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: Container(
                      decoration: BoxDecoration(
                        color: kBg,
                        borderRadius: BorderRadius.circular(18),
                        border: Border.all(color: kBorder),
                      ),
                      child: Row(
                        children: [
                          Expanded(
                            child: TextField(
                              controller: _controller,
                              minLines: 1,
                              maxLines: 4,
                              textInputAction: TextInputAction.send,
                              onSubmitted: (_) => _submitComposer(),
                              style: GoogleFonts.inter(
                                  color: Colors.white, fontSize: 14),
                              decoration: InputDecoration(
                                hintText: 'Type your query here...',
                                hintStyle: GoogleFonts.inter(
                                    color: kMuted, fontSize: 14),
                                border: InputBorder.none,
                                contentPadding: const EdgeInsets.symmetric(
                                    horizontal: 14, vertical: 12),
                              ),
                            ),
                          ),
                          IconButton(
                            onPressed: _loading ? null : _submitComposer,
                            icon: Icon(
                              Icons.send_rounded,
                              color: _loading ? kMuted : kPrimaryLight,
                              size: 20,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _headerChip(String label) => Container(
        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
        decoration: BoxDecoration(
          color: Colors.white.withValues(alpha: 0.15),
          borderRadius: BorderRadius.circular(999),
        ),
        child: Text(label,
            style: GoogleFonts.inter(
                color: Colors.white,
                fontSize: 10,
                fontWeight: FontWeight.w700)),
      );

  Widget _chatBubble(_ChatMessage message) {
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
                Container(
                  width: 36,
                  height: 36,
                  decoration: BoxDecoration(
                    color: kPrimary.withValues(alpha: 0.1),
                    borderRadius: BorderRadius.circular(11),
                    border: Border.all(color: kPrimary.withValues(alpha: 0.2)),
                  ),
                  child: const Icon(Icons.support_agent_rounded,
                      color: kPrimaryLight, size: 17),
                ),
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
              _timeLabel(),
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
                children: message.actions
                    .map((action) => _actionBtn(action))
                    .toList(),
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
                children: message.meta.map((item) => _metaChip(item)).toList(),
              ),
            ),
          ],
        ],
      ),
    );
  }

  Widget _actionBtn(_ChatAction action) => GestureDetector(
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

  Widget _metaChip(_ChatMetaChip item) => Container(
        padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 5),
        decoration: BoxDecoration(
          color: kPrimary.withValues(alpha: 0.1),
          borderRadius: BorderRadius.circular(999),
          border: Border.all(color: kPrimary.withValues(alpha: 0.2)),
        ),
        child: Text(
          '${item.label}: ${item.value}',
          style: GoogleFonts.inter(
              color: kPrimaryLight, fontWeight: FontWeight.w600, fontSize: 11),
        ),
      );

  Widget _connectionCard(CustomerConnection connection) => Padding(
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
                style:
                    GoogleFonts.inter(color: kMuted, fontSize: 12, height: 1.4),
              ),
              const SizedBox(height: 10),
              Wrap(spacing: 6, runSpacing: 6, children: [
                _pill(
                    'Service',
                    connection.serviceId.isEmpty
                        ? connection.customerId
                        : connection.serviceId),
                _pill('Status',
                    connection.status.isEmpty ? '-' : connection.status),
                _pill(
                    'Online',
                    connection.onlineStatus.isEmpty
                        ? 'unknown'
                        : connection.onlineStatus),
                _pill(
                    'Due',
                    connection.dueAmount > 0
                        ? 'Rs ${connection.dueAmount.toStringAsFixed(0)}'
                        : 'clear'),
              ]),
            ],
          ),
        ),
      );

  Widget _ticketCard(SupportTicketItem ticket) {
    final statusColor = _ticketStatusColor(ticket.status);
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
                  padding:
                      const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
                  decoration: BoxDecoration(
                    color: statusColor.withValues(alpha: 0.1),
                    borderRadius: BorderRadius.circular(999),
                    border:
                        Border.all(color: statusColor.withValues(alpha: 0.3)),
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
              _pill('Priority', ticket.priority),
              _pill('Category', ticket.category),
              if (ticket.createdAt.isNotEmpty)
                _pill('Opened', ticket.createdAt),
            ]),
          ],
        ),
      ),
    );
  }

  Color _ticketStatusColor(String status) {
    final n = status.toLowerCase();
    if (n.contains('closed') || n.contains('resolved') || n.contains('done')) {
      return const Color(0xFF22C55E);
    }
    if (n.contains('open') || n.contains('pending') || n.contains('progress')) {
      return const Color(0xFFF59E0B);
    }
    return kPrimaryLight;
  }

  Widget _pill(String label, String value) => Container(
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

  Widget _typingBubble() => Padding(
        padding: const EdgeInsets.only(bottom: 16),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Container(
              width: 36,
              height: 36,
              decoration: BoxDecoration(
                color: kPrimary.withValues(alpha: 0.1),
                borderRadius: BorderRadius.circular(11),
                border: Border.all(color: kPrimary.withValues(alpha: 0.2)),
              ),
              child: const Icon(Icons.support_agent_rounded,
                  color: kPrimaryLight, size: 17),
            ),
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

class _ChatMessage {
  _ChatMessage({
    required this.text,
    required this.isUser,
    this.actions = const [],
    this.meta = const [],
  });

  factory _ChatMessage.user(String text) =>
      _ChatMessage(text: text, isUser: true);
  factory _ChatMessage.bot(String text,
          {List<_ChatAction> actions = const [],
          List<_ChatMetaChip> meta = const []}) =>
      _ChatMessage(text: text, isUser: false, actions: actions, meta: meta);

  final String text;
  final bool isUser;
  final List<_ChatAction> actions;
  final List<_ChatMetaChip> meta;
}

class _ChatAction {
  const _ChatAction(
      {required this.label, required this.onTap, this.primary = false});
  final String label;
  final VoidCallback onTap;
  final bool primary;
}

class _ChatMetaChip {
  const _ChatMetaChip({required this.label, required this.value});
  final String label;
  final String value;
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
