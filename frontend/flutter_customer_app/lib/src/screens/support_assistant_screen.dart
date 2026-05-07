import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:url_launcher/url_launcher.dart';

import '../core/app_state.dart';
import '../core/models.dart';
import '../core/theme.dart';
import '../widgets/support_chat_widgets.dart';
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
  final List<ChatMessage> _messages = [];

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
      _messages.add(ChatMessage.bot(
          'We are here to help you out. Tell me what is happening with your connection, billing, Wi-Fi, or speed.\n\nHindi mein bhi type kar sakte hain — internet nahi chal raha, speed slow hai, bill ka issue, ya Wi-Fi problem.'));
      _messages.add(ChatMessage.bot(
          'You can type things like: internet not working, Wi-Fi problem, slow speed, bill issue, or plan issue.\n\nYa phir: net band ho gaya, speed kam hai, bill bhar diya phir bhi band hai, wifi password bhool gaya.'));
      if (_latestTicket != null) {
        _messages.add(ChatMessage.bot(
            'Your latest support case is ${_latestTicket!.ticketNumber} with status ${_latestTicket!.status}. If this is about the same issue, type still not resolved.'));
      }
      if (widget.issueType != 'general') {
        _messages.add(ChatMessage.user(prompt));
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

  /// Order matters: first matching bucket wins. Defaults to `internet`.
  static const _issueKeywords = <String, List<String>>{
    'billing': ['bill', 'due', 'payment', 'recharge', 'bhar diya',
        'bhugtan', 'invoice', 'paisa', 'paise'],
    'wifi': ['wifi', 'wi-fi', 'ssid', 'router', 'password', 'pasword',
        'passward', 'wifi band', 'net nahi aa'],
    'speed': ['slow', 'speed', 'latency', 'ping', 'dhima', 'buffering',
        'lagging'],
    'plan': ['plan', 'fup', 'data', 'upgrade', 'cap', 'badlo',
        'change karo', 'recharge plan'],
    'internet': ['band ho gaya', 'nahi chal', 'nahi aa', 'net band',
        'internet band', 'not working', 'down hai', 'kaam nahi'],
  };

  static const _followUpKeywords = <String>[
    'still', 'not resolved', 'not fixed', 'same issue', 'continue',
    'proceed', 'agent', 'human', 'abhi bhi', 'phir bhi',
    'theek nahi', 'solve nahi', 'nahi hua',
  ];

  static const _followUpExact = <String>{'yes', 'haan', 'ha'};

  String _inferIssueType(String text) {
    final q = text.toLowerCase();
    for (final entry in _issueKeywords.entries) {
      if (entry.value.any(q.contains)) return entry.key;
    }
    return 'internet';
  }

  bool _isFollowUpIntent(String text) {
    final q = text.toLowerCase();
    return _followUpExact.contains(q) || _followUpKeywords.any(q.contains);
  }

  bool _isTicketOpen(String status) {
    final value = status.toLowerCase();
    return !(value.contains('closed') ||
        value.contains('resolved') ||
        value.contains('done') ||
        value.contains('completed'));
  }

  bool _looksLikeSameIssue(SupportTicketItem ticket, SupportDiagnosis diagnosis) {
    final issueType = diagnosis.issueType.toLowerCase();
    final category = ticket.category.toLowerCase();
    final text = '${ticket.subject} ${ticket.description}'.toLowerCase();
    if (!_isTicketOpen(ticket.status)) return false;
    if (issueType == 'billing') {
      return category.contains('billing') || text.contains('billing') || text.contains('payment');
    }
    if (issueType == 'plan') {
      return text.contains('plan') || text.contains('fup') || text.contains('data');
    }
    if (issueType == 'wifi') {
      return text.contains('wifi') || text.contains('wi-fi') || text.contains('router');
    }
    if (issueType == 'speed') {
      return text.contains('speed') || text.contains('slow');
    }
    return category.contains('technical') ||
        text.contains('internet') ||
        text.contains('offline') ||
        text.contains('link');
  }

  SupportTicketItem? _findMatchingOpenTicket(
      AppState appState, SupportDiagnosis diagnosis) {
    for (final ticket in appState.tickets) {
      if (_looksLikeSameIssue(ticket, diagnosis)) return ticket;
    }
    return null;
  }

  Future<void> _copyTicketReference(SupportTicketItem ticket) async {
    await Clipboard.setData(ClipboardData(text: ticket.ticketNumber));
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text('Reference copied: ${ticket.ticketNumber}')),
    );
  }

  bool _handleContextualReply(String text) {
    final diagnosis = _lastDiagnosis;
    if (diagnosis == null) return false;
    final q = text.toLowerCase();
    if (q.contains('agent') || q.contains('human')) {
      setState(() {
        _messages.add(ChatMessage.bot(
          'I can prepare the full diagnostic snapshot and hand this over as a complaint for the support team.',
          actions: [
            ChatAction(
                label: 'Raise complaint', onTap: _raiseComplaint, primary: true)
          ],
        ));
      });
      _scrollToBottom();
      return true;
    }
    if (_isFollowUpIntent(text)) {
      setState(() {
        _messages.add(ChatMessage.bot(
          diagnosis.needsTicket
              ? 'This still looks like a service-side issue from our checks. The fastest next step is to raise a complaint so the support team can act on the diagnosis directly.'
              : 'I can run the checks again for you, or I can raise a complaint if you want a manual investigation.',
          actions: [
            if (diagnosis.needsTicket)
              ChatAction(
                  label: 'Raise complaint',
                  onTap: _raiseComplaint,
                  primary: true)
            else
              ChatAction(
                label: 'Check again',
                onTap: () => _sendUserIntent('Please check my issue again',
                    issueTypeOverride: diagnosis.issueType),
                primary: true,
              ),
            if (!diagnosis.needsTicket)
              ChatAction(label: 'Raise complaint', onTap: _raiseComplaint),
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
        _messages.add(ChatMessage.bot(
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
      final matchingTicket = _findMatchingOpenTicket(appState, diagnosis);
      final actions = _actionsForDiagnosis(diagnosis, matchingTicket);
      setState(() {
        _lastDiagnosis = diagnosis;
        _loading = false;
        _messages.add(ChatMessage.bot(
          '${_humanHeadline(diagnosis)}\n\n${diagnosis.summary}',
          actions: actions,
          meta: [
            ChatMetaChip(label: 'Internet', value: diagnosis.internetStatus),
            ChatMetaChip(label: 'Wi-Fi', value: diagnosis.wifiStatus),
            ChatMetaChip(label: 'Line', value: diagnosis.lineStatus),
          ],
        ));
        _messages.add(ChatMessage.bot(_diagnosisSnapshotText(diagnosis)));
        if (diagnosis.steps.isNotEmpty) {
          _messages.add(ChatMessage.bot(
            diagnosis.steps
                .asMap()
                .entries
                .map((e) => '${e.key + 1}. ${e.value}')
                .join('\n'),
          ));
        }
        if (matchingTicket != null) {
          _latestTicket = matchingTicket;
          _messages.add(ChatMessage.bot(
            'You already have an open case for this issue: ${matchingTicket.ticketNumber} (${matchingTicket.status}). It is better to continue with the same case instead of raising a duplicate complaint.',
            actions: [
              ChatAction(
                label: 'Copy reference',
                onTap: () => _copyTicketReference(matchingTicket),
                primary: true,
              ),
              ChatAction(
                label: 'Check again',
                onTap: () => _sendUserIntent(
                  'Please check my issue again',
                  issueTypeOverride: diagnosis.issueType,
                ),
              ),
            ],
          ));
        }
      });
      _scrollToBottom();
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _loading = false;
        _messages.add(ChatMessage.bot(
          'I could not complete the checks right now. Please try again, or raise a complaint if the issue is urgent.',
          actions: [
            ChatAction(
                label: 'Check again',
                onTap: () =>
                    _sendUserIntent(text, issueTypeOverride: issueType)),
            ChatAction(label: 'Raise complaint', onTap: _raiseComplaint),
          ],
        ));
      });
      _scrollToBottom();
      ScaffoldMessenger.of(context)
          .showSnackBar(SnackBar(content: Text(e.toString())));
    }
  }

  List<ChatAction> _actionsForDiagnosis(
    SupportDiagnosis diagnosis,
    SupportTicketItem? matchingTicket,
  ) {
    if (matchingTicket != null) {
      return [
        ChatAction(
          label: 'Copy reference',
          onTap: () => _copyTicketReference(matchingTicket),
          primary: true,
        ),
        ChatAction(
          label: 'Check again',
          onTap: () => _sendUserIntent(
            'Please check my issue again',
            issueTypeOverride: diagnosis.issueType,
          ),
        ),
      ];
    }
    if (diagnosis.diagnosisCode == 'billing_suspended' ||
        diagnosis.diagnosisCode == 'payment_pending') {
      return [
        ChatAction(label: 'Open billing', onTap: _openBilling, primary: true),
        ChatAction(label: 'Raise complaint', onTap: _raiseComplaint),
      ];
    }
    if (diagnosis.diagnosisCode == 'data_limit_reached' ||
        diagnosis.diagnosisCode == 'fup_applied' ||
        diagnosis.diagnosisCode == 'speed_fup_limited' ||
        diagnosis.diagnosisCode == 'speed_hard_cap') {
      return [
        ChatAction(label: 'Open plans', onTap: _openPlans, primary: true),
        ChatAction(label: 'Raise complaint', onTap: _raiseComplaint),
      ];
    }
    if (diagnosis.needsTicket) {
      return [
        ChatAction(
            label: 'Raise complaint', onTap: _raiseComplaint, primary: true),
        ChatAction(
            label: 'Check again',
            onTap: () => _sendUserIntent('Please check my issue again',
                issueTypeOverride: diagnosis.issueType)),
      ];
    }
    return [
      ChatAction(
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

  static const _headlineByCode = <String, String>{
    'billing_suspended':
        'Your connection looks paused because there is a billing due on this account.',
    'payment_pending':
        'I can see a pending billing issue on this connection.',
    'data_limit_reached':
        'This connection has reached its current data limit.',
    'fup_applied':
        'Your connection is currently under reduced speed because FUP is active.',
    'device_offline':
        'The router or line does not look fully online right now.',
    'speed_router_offline':
        'The router or line does not look fully online right now.',
    'wifi_backhaul_down':
        'The router or line does not look fully online right now.',
    'degraded_link':
        'I am seeing line or speed quality below the expected level.',
    'speed_below_expected':
        'I am seeing line or speed quality below the expected level.',
    'wifi_access_control':
        'This looks like a Wi-Fi device access issue rather than a full network outage.',
    'wifi_quality_weak':
        'The issue looks more like local Wi-Fi quality than a complete line failure.',
    'healthy_connection': 'The connection checks mostly look healthy from our side.',
    'billing_clear': 'The connection checks mostly look healthy from our side.',
    'plan_healthy': 'The connection checks mostly look healthy from our side.',
    'speed_normal': 'The connection checks mostly look healthy from our side.',
  };

  String _humanHeadline(SupportDiagnosis diagnosis) =>
      _headlineByCode[diagnosis.diagnosisCode] ?? diagnosis.headline;

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
    final matchingTicket = _findMatchingOpenTicket(appState, diagnosis);
    if (matchingTicket != null) {
      setState(() {
        _latestTicket = matchingTicket;
        _messages.add(ChatMessage.bot(
          'An open case already exists for this issue: ${matchingTicket.ticketNumber}. I have kept that case as the active reference so we do not create a duplicate complaint.',
          actions: [
            ChatAction(
              label: 'Copy reference',
              onTap: () => _copyTicketReference(matchingTicket),
              primary: true,
            ),
          ],
        ));
      });
      _scrollToBottom();
      return;
    }
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
      _messages.add(ChatMessage.bot(
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
        _messages.add(ChatMessage.bot(
            'Our support team will now review your connection snapshot and continue the case from this reference. You can track updates from Support & requests.'));
        _messages.add(ChatMessage.bot(
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
      _messages.add(ChatMessage.user(text));
      _controller.clear();
    });
    _scrollToBottom();
    if (_handleContextualReply(text)) return;
    _sendUserIntent(text);
  }

  void _sendQuickReply(String text, String issueType) {
    if (_loading) return;
    setState(() {
      _messages.add(ChatMessage.user(text));
    });
    _scrollToBottom();
    _sendUserIntent(text, issueTypeOverride: issueType);
  }

  Future<void> _callSupport() async {
    final uri = Uri(scheme: 'tel', path: '+919240204444');
    if (await canLaunchUrl(uri)) {
      await launchUrl(uri);
    } else if (mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Unable to start a call.')),
      );
    }
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
                    // Quick call button (escalate to phone)
                    GestureDetector(
                      onTap: _callSupport,
                      child: Container(
                        padding: const EdgeInsets.symmetric(
                            horizontal: 12, vertical: 8),
                        decoration: BoxDecoration(
                          color: const Color(0xFF34D399),
                          borderRadius: BorderRadius.circular(999),
                          boxShadow: [
                            BoxShadow(
                              color: const Color(0xFF34D399)
                                  .withValues(alpha: 0.4),
                              blurRadius: 12,
                              offset: const Offset(0, 4),
                            ),
                          ],
                        ),
                        child: Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            const Icon(Icons.call_rounded,
                                color: Colors.black, size: 14),
                            const SizedBox(width: 6),
                            Text('Call',
                                style: GoogleFonts.inter(
                                    color: Colors.black,
                                    fontSize: 12,
                                    fontWeight: FontWeight.w800)),
                          ],
                        ),
                      ),
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
                  return ConnectionContextCard(connection: selectedConnection);
                }
                final ticketOffset = selectedConnection == null ? 0 : 1;
                if (_latestTicket != null && index == ticketOffset) {
                  return TicketContextCard(ticket: _latestTicket!);
                }
                final msgIndex =
                    index - ticketOffset - (_latestTicket == null ? 0 : 1);
                if (_loading && msgIndex == _messages.length) {
                  return const TypingBubble();
                }
                return ChatBubble(
                  message: _messages[msgIndex],
                  timeLabel: _timeLabel(),
                );
              },
            ),
          ),

          // ── Quick replies (only before user starts typing) ───────────
          if (!_messages.any((m) => m.isUser))
            Container(
              padding: const EdgeInsets.fromLTRB(14, 0, 14, 8),
              child: SizedBox(
                height: 36,
                child: ListView(
                  scrollDirection: Axis.horizontal,
                  children: [
                    _quickChip('🌐 Net not working', 'internet'),
                    _quickChip('🐢 Slow speed', 'speed'),
                    _quickChip('📶 Wi-Fi password', 'wifi'),
                    _quickChip('🧾 Bill issue', 'billing'),
                    _quickChip('📦 Change plan', 'plan'),
                  ],
                ),
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

  Widget _quickChip(String label, String issueType) => Padding(
        padding: const EdgeInsets.only(right: 8),
        child: GestureDetector(
          onTap: () => _sendQuickReply(label, issueType),
          child: Container(
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
            decoration: BoxDecoration(
              color: kSurface,
              borderRadius: BorderRadius.circular(999),
              border: Border.all(color: kPrimary.withValues(alpha: 0.4)),
            ),
            child: Text(label,
                style: GoogleFonts.inter(
                    color: Colors.white,
                    fontSize: 12,
                    fontWeight: FontWeight.w700)),
          ),
        ),
      );
}

