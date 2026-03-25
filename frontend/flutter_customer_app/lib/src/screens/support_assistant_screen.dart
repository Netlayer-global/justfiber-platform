import 'package:flutter/material.dart';

import '../core/app_state.dart';
import '../core/models.dart';
import 'billing_history_screen.dart';
import 'plan_catalog_screen.dart';

class SupportAssistantScreen extends StatefulWidget {
  const SupportAssistantScreen({
    super.key,
    this.issueType = 'general',
  });

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
      _messages.add(
        _ChatMessage.bot(
          'We are here to help you out. Tell me what is happening with your connection, billing, Wi-Fi, or speed.',
        ),
      );
      _messages.add(
        _ChatMessage.bot(
          'You can type things like: internet not working, Wi-Fi problem, slow speed, bill issue, or plan issue.',
        ),
      );
      if (_latestTicket != null) {
        _messages.add(
          _ChatMessage.bot(
            'Your latest support case is ${_latestTicket!.ticketNumber} with status ${_latestTicket!.status}. If this is about the same issue, type still not resolved.',
          ),
        );
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
    final query = text.toLowerCase();
    if (query.contains('bill') ||
        query.contains('billing') ||
        query.contains('due') ||
        query.contains('payment') ||
        query.contains('recharge')) {
      return 'billing';
    }
    if (query.contains('wifi') ||
        query.contains('wi-fi') ||
        query.contains('ssid') ||
        query.contains('router') ||
        query.contains('password')) {
      return 'wifi';
    }
    if (query.contains('slow') ||
        query.contains('speed') ||
        query.contains('latency') ||
        query.contains('ping')) {
      return 'speed';
    }
    if (query.contains('plan') ||
        query.contains('fup') ||
        query.contains('data') ||
        query.contains('upgrade') ||
        query.contains('cap')) {
      return 'plan';
    }
    return 'internet';
  }

  bool _isFollowUpIntent(String text) {
    final query = text.toLowerCase();
    return query.contains('still') ||
        query.contains('not resolved') ||
        query.contains('not fixed') ||
        query.contains('same issue') ||
        query.contains('continue') ||
        query.contains('proceed') ||
        query == 'yes' ||
        query.contains('agent') ||
        query.contains('human');
  }

  bool _handleContextualReply(String text) {
    final diagnosis = _lastDiagnosis;
    if (diagnosis == null) return false;
    final query = text.toLowerCase();

    if (query.contains('agent') || query.contains('human')) {
      setState(() {
        _messages.add(
          _ChatMessage.bot(
            'I can prepare the full diagnostic snapshot and hand this over as a complaint for the support team.',
            actions: [
              _ChatAction(label: 'Raise complaint', onTap: _raiseComplaint, primary: true),
            ],
          ),
        );
      });
      _scrollToBottom();
      return true;
    }

    if (_isFollowUpIntent(text)) {
      setState(() {
        _messages.add(
          _ChatMessage.bot(
            diagnosis.needsTicket
                ? 'This still looks like a service-side issue from our checks. The fastest next step is to raise a complaint so the support team can act on the diagnosis directly.'
                : 'I can run the checks again for you, or I can raise a complaint if you want a manual investigation.',
            actions: [
              if (diagnosis.needsTicket)
                _ChatAction(label: 'Raise complaint', onTap: _raiseComplaint, primary: true)
              else
                _ChatAction(
                  label: 'Check again',
                  onTap: () => _sendUserIntent('Please check my issue again', issueTypeOverride: diagnosis.issueType),
                  primary: true,
                ),
              if (!diagnosis.needsTicket)
                _ChatAction(label: 'Raise complaint', onTap: _raiseComplaint),
            ],
          ),
        );
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
        _messages.add(
          _ChatMessage.bot('Please login again so I can check your account and connection health.'),
        );
      });
      return;
    }

    final issueType = issueTypeOverride ?? _inferIssueType(text);
    setState(() {
      _loading = true;
    });
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
        _messages.add(
          _ChatMessage.bot(
            '${_humanHeadline(diagnosis)}\n\n${diagnosis.summary}',
            actions: actions,
          ),
        );
        _messages.add(
          _ChatMessage.bot(
            _diagnosisSnapshotText(diagnosis),
          ),
        );
        if (diagnosis.steps.isNotEmpty) {
          _messages.add(
            _ChatMessage.bot(
              diagnosis.steps.asMap().entries.map((entry) => '${entry.key + 1}. ${entry.value}').join('\n'),
            ),
          );
        }
      });
      _scrollToBottom();
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _loading = false;
        _messages.add(
          _ChatMessage.bot(
            'I could not complete the checks right now. Please try again, or raise a complaint if the issue is urgent.',
            actions: [
              _ChatAction(label: 'Check again', onTap: () => _sendUserIntent(text, issueTypeOverride: issueType)),
              _ChatAction(label: 'Raise complaint', onTap: _raiseComplaint),
            ],
          ),
        );
      });
      _scrollToBottom();
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(e.toString())),
      );
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
        _ChatAction(label: 'Raise complaint', onTap: _raiseComplaint, primary: true),
        _ChatAction(label: 'Check again', onTap: () => _sendUserIntent('Please check my issue again', issueTypeOverride: diagnosis.issueType)),
      ];
    }
    return [
      _ChatAction(label: 'Check again', onTap: () => _sendUserIntent('Please check my issue again', issueTypeOverride: diagnosis.issueType), primary: true),
    ];
  }

  String _diagnosisSnapshotText(SupportDiagnosis diagnosis) {
    final opticalText = diagnosis.opticalRxPower == null ? '-' : '${diagnosis.opticalRxPower!.toStringAsFixed(1)} dBm';
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
    await Navigator.of(context).push(
      MaterialPageRoute(builder: (_) => const BillingHistoryScreen()),
    );
    if (!mounted) return;
    await AppStateScope.of(context).refresh();
  }

  Future<void> _openPlans() async {
    await Navigator.of(context).push(
      MaterialPageRoute(builder: (_) => const PlanCatalogScreen()),
    );
    if (!mounted) return;
    await AppStateScope.of(context).refresh();
  }

  Future<void> _raiseComplaint() async {
    final appState = AppStateScope.of(context);
    final diagnosis = _lastDiagnosis;
    if (diagnosis == null || _raisingTicket) return;
    setState(() => _raisingTicket = true);
    final ticketNumber = await appState.raiseComplaint(
      category: diagnosis.issueType == 'billing' ? 'billing' : 'technical',
      subject: diagnosis.issueType == 'billing'
          ? 'Billing issue detected'
          : diagnosis.issueType == 'plan'
              ? 'Plan issue detected'
              : diagnosis.issueType == 'wifi'
                  ? 'Wi-Fi issue detected'
                  : diagnosis.issueType == 'speed'
                      ? 'Slow speed detected'
                      : 'Internet issue detected',
      description:
          '${diagnosis.headline}\n\n'
          '${diagnosis.summary}\n\n'
          'Recommendation: ${diagnosis.recommendation}\n\n'
          'Snapshot:\n'
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
      _messages.add(
        _ChatMessage.bot(
          ticketNumber != null
              ? 'Your complaint has been raised successfully. Reference: $ticketNumber'
              : (appState.error ?? 'I could not raise the complaint right now. Please try again shortly.'),
        ),
      );
      if (ticketNumber != null) {
        _latestTicket = SupportTicketItem(
          id: '',
          ticketNumber: ticketNumber,
          category: diagnosis.issueType == 'billing' ? 'billing' : 'technical',
          subject: diagnosis.issueType == 'billing'
              ? 'Billing issue detected'
              : diagnosis.issueType == 'plan'
                  ? 'Plan issue detected'
                  : diagnosis.issueType == 'wifi'
                      ? 'Wi-Fi issue detected'
                      : diagnosis.issueType == 'speed'
                          ? 'Slow speed detected'
                          : 'Internet issue detected',
          description: diagnosis.summary,
          latestUpdateNote: 'Complaint created from support chat',
          latestUpdateAt: '',
          status: 'open',
          priority: diagnosis.needsTicket ? 'high' : 'normal',
          createdAt: '',
        );
        _messages.add(
          _ChatMessage.bot(
            'Our support team will now review your connection snapshot and continue the case from this reference. You can track updates from Support & requests.',
          ),
        );
      }
    });
    _scrollToBottom();
    if (ticketNumber != null) {
      await appState.refresh();
    }
  }

  void _submitComposer() {
    final text = _controller.text.trim();
    if (text.isEmpty || _loading) return;
    setState(() {
      _messages.add(_ChatMessage.user(text));
      _controller.clear();
    });
    _scrollToBottom();
    if (_handleContextualReply(text)) {
      return;
    }
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
      backgroundColor: const Color(0xFFF7F3FF),
      appBar: AppBar(
        titleSpacing: 0,
        title: const Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              'justfiber chat',
              style: TextStyle(fontWeight: FontWeight.w800, fontSize: 22),
            ),
            SizedBox(height: 2),
            Text(
              'get help 24x7',
              style: TextStyle(fontWeight: FontWeight.w500, fontSize: 13, color: Color(0xFF6E6A67)),
            ),
          ],
        ),
      ),
      body: SafeArea(
        child: Column(
          children: [
            Expanded(
              child: ListView.builder(
                controller: _scrollController,
                padding: const EdgeInsets.fromLTRB(18, 16, 18, 24),
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
                  final messageIndex = index - ticketOffset - (_latestTicket == null ? 0 : 1);
                  if (_loading && messageIndex == _messages.length) {
                    return _assistantTypingBubble();
                  }
                  final message = _messages[messageIndex];
                  return _chatBubble(message);
                },
              ),
            ),
            Container(
              padding: const EdgeInsets.fromLTRB(14, 12, 14, 14),
              decoration: const BoxDecoration(
                color: Color(0xFFF1ECFF),
                border: Border(top: BorderSide(color: Color(0x14000000))),
              ),
              child: Row(
                children: [
                  Container(
                    width: 46,
                    height: 46,
                    decoration: BoxDecoration(
                      color: const Color(0xFFFFFFFF),
                      borderRadius: BorderRadius.circular(16),
                      border: Border.all(color: const Color(0x228224E3)),
                    ),
                    child: const Icon(Icons.support_agent_rounded, color: Color(0xFF8224E3)),
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: Container(
                      decoration: BoxDecoration(
                        color: const Color(0xFFFFFFFF),
                        borderRadius: BorderRadius.circular(20),
                        border: Border.all(color: const Color(0x228224E3)),
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
                              decoration: const InputDecoration(
                                hintText: 'Type your query here...',
                                border: InputBorder.none,
                                contentPadding: EdgeInsets.symmetric(horizontal: 16, vertical: 14),
                              ),
                            ),
                          ),
                          IconButton(
                            onPressed: _loading ? null : _submitComposer,
                            icon: Icon(
                              Icons.send_rounded,
                              color: _loading ? const Color(0xFFB9B2C5) : const Color(0xFF8224E3),
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _chatBubble(_ChatMessage message) {
    final alignment = message.isUser ? CrossAxisAlignment.end : CrossAxisAlignment.start;
    final bubbleColor = message.isUser ? const Color(0xFFEFE9FF) : const Color(0xFFFFFFFF);
    final borderColor = message.isUser ? const Color(0x338224E3) : const Color(0x22000000);
    final radius = BorderRadius.only(
      topLeft: const Radius.circular(22),
      topRight: const Radius.circular(22),
      bottomLeft: Radius.circular(message.isUser ? 22 : 8),
      bottomRight: Radius.circular(message.isUser ? 8 : 22),
    );

    return Padding(
      padding: const EdgeInsets.only(bottom: 18),
      child: Column(
        crossAxisAlignment: alignment,
        children: [
          Row(
            mainAxisAlignment: message.isUser ? MainAxisAlignment.end : MainAxisAlignment.start,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              if (!message.isUser) ...[
                Container(
                  width: 40,
                  height: 40,
                  decoration: BoxDecoration(
                    color: const Color(0xFFFFFFFF),
                    borderRadius: BorderRadius.circular(14),
                    border: Border.all(color: const Color(0x22000000)),
                  ),
                  child: const Icon(Icons.support_agent_rounded, color: Color(0xFF8224E3)),
                ),
                const SizedBox(width: 10),
              ],
              Flexible(
                child: Container(
                  padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
                  decoration: BoxDecoration(
                    color: bubbleColor,
                    borderRadius: radius,
                    border: Border.all(color: borderColor),
                  ),
                  child: Text(
                    message.text,
                    style: const TextStyle(color: Color(0xFF131313), height: 1.42, fontWeight: FontWeight.w600),
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 6),
          Padding(
            padding: EdgeInsets.only(left: message.isUser ? 0 : 52, right: message.isUser ? 8 : 0),
            child: Text(
              _timeLabel(),
              style: const TextStyle(color: Color(0xFF8E8898), fontSize: 12, fontWeight: FontWeight.w500),
            ),
          ),
          if (message.actions.isNotEmpty) ...[
            const SizedBox(height: 10),
            Padding(
              padding: const EdgeInsets.only(left: 52),
              child: Wrap(
                spacing: 10,
                runSpacing: 10,
                children: message.actions
                    .map(
                      (action) => OutlinedButton(
                        onPressed: action.onTap,
                        style: action.primary
                            ? OutlinedButton.styleFrom(
                                foregroundColor: const Color(0xFFFFFFFF),
                                backgroundColor: const Color(0xFF8224E3),
                                side: const BorderSide(color: Color(0xFF8224E3)),
                                padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 14),
                                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(18)),
                              )
                            : OutlinedButton.styleFrom(
                                foregroundColor: const Color(0xFF1860D9),
                                backgroundColor: const Color(0xFFF8F6FF),
                                side: const BorderSide(color: Color(0x22000000)),
                                padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 14),
                                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(18)),
                              ),
                        child: Text(
                          action.label,
                          style: const TextStyle(fontWeight: FontWeight.w800),
                        ),
                      ),
                    )
                    .toList(),
              ),
            ),
          ],
        ],
      ),
    );
  }

  Widget _connectionCard(CustomerConnection connection) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 18),
      child: Container(
        width: double.infinity,
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: const Color(0xFFFFFFFF),
          borderRadius: BorderRadius.circular(22),
          border: Border.all(color: const Color(0x228224E3)),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text(
              'ACTIVE CONNECTION',
              style: TextStyle(
                color: Color(0xFF8224E3),
                fontWeight: FontWeight.w800,
                letterSpacing: 2.2,
                fontSize: 11,
              ),
            ),
            const SizedBox(height: 8),
            Text(
              connection.planName.isEmpty ? 'Broadband connection' : connection.planName,
              style: const TextStyle(
                color: Color(0xFF131313),
                fontWeight: FontWeight.w800,
                fontSize: 18,
              ),
            ),
            const SizedBox(height: 6),
            Text(
              connection.address.isEmpty ? connection.serviceId : connection.address,
              style: const TextStyle(color: Color(0xFF6E6A67), height: 1.4),
            ),
            const SizedBox(height: 12),
            Wrap(
              spacing: 8,
              runSpacing: 8,
              children: [
                _connectionPill('Service', connection.serviceId.isEmpty ? connection.customerId : connection.serviceId),
                _connectionPill('Status', connection.status.isEmpty ? '-' : connection.status),
                _connectionPill('Online', connection.onlineStatus.isEmpty ? 'unknown' : connection.onlineStatus),
                _connectionPill(
                  'Due',
                  connection.dueAmount > 0 ? 'Rs ${connection.dueAmount.toStringAsFixed(0)}' : 'clear',
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }

  Widget _connectionPill(String label, String value) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
      decoration: BoxDecoration(
        color: const Color(0xFFF8F4FF),
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: const Color(0x228224E3)),
      ),
      child: Text(
        '$label: $value',
        style: const TextStyle(color: Color(0xFF131313), fontWeight: FontWeight.w700),
      ),
    );
  }

  Widget _ticketCard(SupportTicketItem ticket) {
    final statusColor = _ticketStatusColor(ticket.status);
    return Padding(
      padding: const EdgeInsets.only(bottom: 18),
      child: Container(
        width: double.infinity,
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: const Color(0xFFFFFFFF),
          borderRadius: BorderRadius.circular(22),
          border: Border.all(color: const Color(0x228224E3)),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text(
              'LATEST TICKET',
              style: TextStyle(
                color: Color(0xFF8224E3),
                fontWeight: FontWeight.w800,
                letterSpacing: 2.2,
                fontSize: 11,
              ),
            ),
            const SizedBox(height: 8),
            Row(
              children: [
                Expanded(
                  child: Text(
                    ticket.ticketNumber,
                    style: const TextStyle(
                      color: Color(0xFF131313),
                      fontWeight: FontWeight.w800,
                      fontSize: 18,
                    ),
                  ),
                ),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                  decoration: BoxDecoration(
                    color: statusColor.withValues(alpha: 0.10),
                    borderRadius: BorderRadius.circular(999),
                    border: Border.all(color: statusColor.withValues(alpha: 0.26)),
                  ),
                  child: Text(
                    ticket.status,
                    style: TextStyle(
                      color: statusColor,
                      fontWeight: FontWeight.w800,
                    ),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 6),
            Text(
              ticket.subject,
              style: const TextStyle(color: Color(0xFF6E6A67), height: 1.4),
            ),
            if (ticket.latestUpdateNote.isNotEmpty) ...[
              const SizedBox(height: 8),
              Container(
                width: double.infinity,
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: const Color(0xFFF8F4FF),
                  borderRadius: BorderRadius.circular(16),
                  border: Border.all(color: const Color(0x228224E3)),
                ),
                child: Text(
                  'Latest update: ${ticket.latestUpdateNote}',
                  style: const TextStyle(color: Color(0xFF6E6A67), height: 1.4, fontWeight: FontWeight.w600),
                ),
              ),
            ],
            const SizedBox(height: 12),
            Wrap(
              spacing: 8,
              runSpacing: 8,
              children: [
                _connectionPill('Priority', ticket.priority),
                _connectionPill('Category', ticket.category),
                if (ticket.createdAt.isNotEmpty) _connectionPill('Opened', ticket.createdAt),
              ],
            ),
          ],
        ),
      ),
    );
  }

  Color _ticketStatusColor(String status) {
    final normalized = status.toLowerCase();
    if (normalized.contains('closed') || normalized.contains('resolved') || normalized.contains('done')) {
      return const Color(0xFF16A34A);
    }
    if (normalized.contains('open') || normalized.contains('pending') || normalized.contains('progress')) {
      return const Color(0xFFF59E0B);
    }
    return const Color(0xFF8224E3);
  }

  Widget _assistantTypingBubble() {
    return Padding(
      padding: const EdgeInsets.only(bottom: 18),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            width: 40,
            height: 40,
            decoration: BoxDecoration(
              color: const Color(0xFFFFFFFF),
              borderRadius: BorderRadius.circular(14),
              border: Border.all(color: const Color(0x22000000)),
            ),
            child: const Icon(Icons.support_agent_rounded, color: Color(0xFF8224E3)),
          ),
          const SizedBox(width: 10),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
            decoration: BoxDecoration(
              color: const Color(0xFFFFFFFF),
              borderRadius: const BorderRadius.only(
                topLeft: Radius.circular(22),
                topRight: Radius.circular(22),
                bottomLeft: Radius.circular(8),
                bottomRight: Radius.circular(22),
              ),
              border: Border.all(color: const Color(0x22000000)),
            ),
            child: const SizedBox(
              width: 56,
              child: Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  _TypingDot(),
                  _TypingDot(),
                  _TypingDot(),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _ChatMessage {
  _ChatMessage({
    required this.text,
    required this.isUser,
    this.actions = const [],
  });

  factory _ChatMessage.user(String text) => _ChatMessage(text: text, isUser: true);

  factory _ChatMessage.bot(String text, {List<_ChatAction> actions = const []}) =>
      _ChatMessage(text: text, isUser: false, actions: actions);

  final String text;
  final bool isUser;
  final List<_ChatAction> actions;
}

class _ChatAction {
  const _ChatAction({
    required this.label,
    required this.onTap,
    this.primary = false,
  });

  final String label;
  final VoidCallback onTap;
  final bool primary;
}

class _TypingDot extends StatelessWidget {
  const _TypingDot();

  @override
  Widget build(BuildContext context) {
    return Container(
      width: 8,
      height: 8,
      decoration: const BoxDecoration(
        color: Color(0xFFB4AFC0),
        shape: BoxShape.circle,
      ),
    );
  }
}
