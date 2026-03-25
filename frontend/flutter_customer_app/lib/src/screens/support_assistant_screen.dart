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
    setState(() {
      _messages.add(
        _ChatMessage.bot(
          'We are here to help you out. Tell me what is happening with your connection, billing, Wi-Fi, or speed.',
        ),
      );
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
            '${diagnosis.headline}\n\n${diagnosis.summary}\n\n${diagnosis.recommendation}',
            actions: actions,
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
        _ChatAction(label: 'Open billing', onTap: _openBilling),
        _ChatAction(label: 'Raise complaint', onTap: _raiseComplaint),
      ];
    }
    if (diagnosis.diagnosisCode == 'data_limit_reached' ||
        diagnosis.diagnosisCode == 'fup_applied' ||
        diagnosis.diagnosisCode == 'speed_fup_limited' ||
        diagnosis.diagnosisCode == 'speed_hard_cap') {
      return [
        _ChatAction(label: 'Open plans', onTap: _openPlans),
        _ChatAction(label: 'Raise complaint', onTap: _raiseComplaint),
      ];
    }
    if (diagnosis.needsTicket) {
      return [
        _ChatAction(label: 'Raise complaint', onTap: _raiseComplaint),
        _ChatAction(label: 'Check again', onTap: () => _sendUserIntent('Please check my issue again', issueTypeOverride: diagnosis.issueType)),
      ];
    }
    return [
      _ChatAction(label: 'Check again', onTap: () => _sendUserIntent('Please check my issue again', issueTypeOverride: diagnosis.issueType)),
    ];
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
                itemCount: _messages.length + (_loading ? 1 : 0),
                itemBuilder: (context, index) {
                  if (_loading && index == _messages.length) {
                    return _assistantTypingBubble();
                  }
                  final message = _messages[index];
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
                    child: const Icon(Icons.menu_rounded, color: Color(0xFF8224E3)),
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
                        style: OutlinedButton.styleFrom(
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
  });

  final String label;
  final VoidCallback onTap;
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
