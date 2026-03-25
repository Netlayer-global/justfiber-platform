import 'package:flutter/material.dart';

import '../core/app_state.dart';
import '../core/models.dart';
import '../widgets/app_card.dart';
import 'billing_history_screen.dart';
import 'plan_catalog_screen.dart';

class SupportAssistantScreen extends StatefulWidget {
  const SupportAssistantScreen({
    super.key,
    this.issueType = 'internet',
  });

  final String issueType;

  @override
  State<SupportAssistantScreen> createState() => _SupportAssistantScreenState();
}

class _SupportAssistantScreenState extends State<SupportAssistantScreen> {
  SupportDiagnosis? _diagnosis;
  bool _loading = true;
  bool _raisingTicket = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted) {
        _loadDiagnosis();
      }
    });
  }

  Future<void> _loadDiagnosis() async {
    final appState = AppStateScope.of(context);
    final session = appState.session;
    if (session == null) {
      setState(() {
        _error = 'Please login again to continue support diagnostics.';
        _loading = false;
      });
      return;
    }
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final result = await appState.api.fetchSupportDiagnosis(
        session,
        customerId: appState.selectedCustomerId,
        issueType: widget.issueType,
      );
      if (!mounted) return;
      setState(() {
        _diagnosis = result;
        _loading = false;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _error = e.toString();
        _loading = false;
      });
    }
  }

  Future<void> _raiseComplaint() async {
    final appState = AppStateScope.of(context);
    final diagnosis = _diagnosis;
    if (diagnosis == null) return;
    setState(() => _raisingTicket = true);
    final ticketNumber = await appState.raiseComplaint(
      category: widget.issueType == 'billing' ? 'billing' : 'technical',
      subject: widget.issueType == 'billing'
          ? 'Billing issue detected'
          : widget.issueType == 'plan'
              ? 'Plan issue detected'
              : widget.issueType == 'wifi'
                  ? 'Wi-Fi issue detected'
                  : widget.issueType == 'speed'
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
    setState(() => _raisingTicket = false);
    if (ticketNumber != null) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Complaint raised: $ticketNumber')),
      );
      await appState.refresh();
      return;
    }
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text(appState.error ?? 'Unable to raise complaint right now')),
    );
  }

  @override
  Widget build(BuildContext context) {
    final appState = AppStateScope.of(context);
    final billing = appState.billing;
    final assistantTitle = switch (widget.issueType) {
      'billing' => 'Billing assistant',
      'plan' => 'Plan assistant',
      'wifi' => 'Wi-Fi assistant',
      'speed' => 'Speed assistant',
      _ => 'Internet assistant',
    };
    final assistantHeadline = switch (widget.issueType) {
      'billing' => 'Let me check your billing first',
      'plan' => 'Let me review your plan first',
      'wifi' => 'Let me inspect your Wi-Fi health first',
      'speed' => 'Let me inspect your speed first',
      _ => 'Let me check your line first',
    };
    final assistantSummary = switch (widget.issueType) {
      'billing' => 'We will detect dues, suspension, payment state, and the quickest billing fix before raising a complaint.',
      'plan' => 'We will check plan limits, FUP, and upgrade need before suggesting the next step.',
      'wifi' => 'We will check line reachability, Wi-Fi quality, and device-side issues before raising a complaint.',
      'speed' => 'We will check if speed is being limited by plan, FUP, line quality, or router conditions before raising a complaint.',
      _ => 'We will first detect the likely reason, suggest fixes, and only then raise a complaint if needed.',
    };
    return Scaffold(
      appBar: AppBar(title: Text(assistantTitle)),
      body: RefreshIndicator(
        color: const Color(0xFF8224E3),
        backgroundColor: const Color(0xFFF6F1EB),
        onRefresh: _loadDiagnosis,
        child: ListView(
          padding: const EdgeInsets.fromLTRB(20, 18, 20, 32),
          children: [
            AppCard(
              gradient: const LinearGradient(
                colors: [Color(0xFF8224E3), Color(0xFF9B51E0)],
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    'SMART SUPPORT',
                    style: TextStyle(
                      color: Color(0xFFE9D5FF),
                      fontWeight: FontWeight.w800,
                      letterSpacing: 3.1,
                    ),
                  ),
                  SizedBox(height: 10),
                  Text(
                    assistantHeadline,
                    style: TextStyle(
                      color: Color(0xFFFFFFFF),
                      fontWeight: FontWeight.w800,
                      fontSize: 28,
                    ),
                  ),
                  SizedBox(height: 8),
                  Text(
                    assistantSummary,
                    style: TextStyle(color: Color(0xFFF3E8FF), height: 1.45),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 18),
            if (_loading)
              const AppCard(
                color: Color(0xFFFFFFFF),
                borderColor: Color(0x228224E3),
                child: Padding(
                  padding: EdgeInsets.all(12),
                  child: Column(
                    children: [
                      SizedBox(height: 12),
                      CircularProgressIndicator(color: Color(0xFF8224E3)),
                      SizedBox(height: 16),
                      Text(
                        widget.issueType == 'billing'
                            ? 'Checking due amount, payment state, and service suspension...'
                            : widget.issueType == 'plan'
                                ? 'Checking data policy, cap usage, and upgrade triggers...'
                                : widget.issueType == 'wifi'
                                    ? 'Checking Wi-Fi quality, line reachability, and device state...'
                                    : widget.issueType == 'speed'
                                        ? 'Checking current plan speed, FUP state, and line quality...'
                                : 'Checking billing, line status, speed, and device quality...',
                        textAlign: TextAlign.center,
                        style: TextStyle(color: Color(0xFF6E6A67), height: 1.45),
                      ),
                    ],
                  ),
                ),
              )
            else if (_error != null)
              AppCard(
                color: const Color(0xFFFFFFFF),
                borderColor: const Color(0x22D81F26),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text(
                      'Unable to complete checks',
                      style: TextStyle(fontWeight: FontWeight.w800, fontSize: 20, color: Color(0xFF131313)),
                    ),
                    const SizedBox(height: 8),
                    Text(_error!, style: const TextStyle(color: Color(0xFF6E6A67), height: 1.45)),
                    const SizedBox(height: 14),
                    FilledButton(
                      onPressed: _loadDiagnosis,
                      style: FilledButton.styleFrom(
                        backgroundColor: const Color(0xFF8224E3),
                        foregroundColor: const Color(0xFFFFFFFF),
                      ),
                      child: const Text('Run checks again'),
                    ),
                  ],
                ),
              )
            else if (_diagnosis != null) ...[
              _assistantMessage(
                speaker: 'Assistant',
                text: _diagnosis!.headline,
                emphasis: true,
              ),
              _assistantMessage(
                speaker: 'Diagnosis',
                text: _diagnosis!.summary,
              ),
              _sectionCard(
                title: 'Live checks',
                child: Column(
                  children: [
                    _detailRow('Internet', _diagnosis!.internetStatus),
                    _detailRow('Wi-Fi', _diagnosis!.wifiStatus),
                    _detailRow('Line status', _diagnosis!.lineStatus),
                    _detailRow('Estimated speed', '${_diagnosis!.estimatedSpeedMbps.toStringAsFixed(0)} Mbps'),
                    _detailRow('Latency', '${_diagnosis!.latencyMs.toStringAsFixed(0)} ms'),
                    _detailRow('Packet loss', '${_diagnosis!.packetLossPercent.toStringAsFixed(1)} %'),
                    _detailRow(
                      'Optical RX',
                      _diagnosis!.opticalRxPower == null ? '-' : '${_diagnosis!.opticalRxPower!.toStringAsFixed(1)} dBm',
                      last: true,
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 18),
              _sectionCard(
                title: 'What you should do now',
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      _diagnosis!.recommendation,
                      style: const TextStyle(color: Color(0xFF6E6A67), height: 1.45, fontWeight: FontWeight.w600),
                    ),
                    const SizedBox(height: 14),
                    ..._diagnosis!.steps.asMap().entries.map(
                      (entry) => Padding(
                        padding: const EdgeInsets.only(bottom: 10),
                        child: Row(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Container(
                              width: 26,
                              height: 26,
                              alignment: Alignment.center,
                              decoration: BoxDecoration(
                                color: const Color(0xFFF8F4FF),
                                borderRadius: BorderRadius.circular(999),
                                border: Border.all(color: const Color(0x228224E3)),
                              ),
                              child: Text(
                                '${entry.key + 1}',
                                style: const TextStyle(color: Color(0xFF8224E3), fontWeight: FontWeight.w800),
                              ),
                            ),
                            const SizedBox(width: 12),
                            Expanded(
                              child: Text(
                                entry.value,
                                style: const TextStyle(color: Color(0xFF131313), height: 1.45),
                              ),
                            ),
                          ],
                        ),
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 18),
              if (_diagnosis!.diagnosisCode == 'billing_suspended' || _diagnosis!.diagnosisCode == 'payment_pending')
                _sectionCard(
                  title: 'Fastest fix',
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'Pending amount: Rs ${billing.dueAmount.toStringAsFixed(2)}',
                        style: const TextStyle(color: Color(0xFF131313), fontWeight: FontWeight.w800),
                      ),
                      const SizedBox(height: 12),
                      FilledButton(
                        onPressed: () async {
                          await Navigator.of(context).push(
                            MaterialPageRoute(builder: (_) => const BillingHistoryScreen()),
                          );
                          if (mounted) {
                            await _loadDiagnosis();
                          }
                        },
                        style: FilledButton.styleFrom(
                          backgroundColor: const Color(0xFF8224E3),
                          foregroundColor: const Color(0xFFFFFFFF),
                        ),
                        child: const Text('Open billing and pay now'),
                      ),
                    ],
                  ),
                )
              else if (_diagnosis!.diagnosisCode == 'data_limit_reached' || _diagnosis!.diagnosisCode == 'fup_applied')
                _sectionCard(
                  title: 'Upgrade option',
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Text(
                        'Your issue looks plan-related. You can upgrade immediately from here.',
                        style: TextStyle(color: Color(0xFF6E6A67), height: 1.45),
                      ),
                      const SizedBox(height: 12),
                      FilledButton(
                        onPressed: () async {
                          await Navigator.of(context).push(
                            MaterialPageRoute(builder: (_) => const PlanCatalogScreen()),
                          );
                          if (mounted) {
                            await _loadDiagnosis();
                          }
                        },
                        style: FilledButton.styleFrom(
                          backgroundColor: const Color(0xFF8224E3),
                          foregroundColor: const Color(0xFFFFFFFF),
                        ),
                        child: const Text('Open plans'),
                      ),
                    ],
                  ),
                )
              else
                _sectionCard(
                  title: 'Still not resolved?',
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        _diagnosis!.needsTicket
                            ? 'We already found a likely issue. Raise a complaint and the team can follow up with the right context.'
                            : 'If the issue still continues after the above steps, raise a complaint from here.',
                        style: const TextStyle(color: Color(0xFF6E6A67), height: 1.45),
                      ),
                      const SizedBox(height: 12),
                      FilledButton(
                        onPressed: _raisingTicket ? null : _raiseComplaint,
                        style: FilledButton.styleFrom(
                          backgroundColor: const Color(0xFF8224E3),
                          foregroundColor: const Color(0xFFFFFFFF),
                        ),
                        child: Text(_raisingTicket ? 'Raising complaint...' : 'Raise complaint'),
                      ),
                    ],
                  ),
                ),
            ],
          ],
        ),
      ),
    );
  }

  Widget _assistantMessage({
    required String speaker,
    required String text,
    bool emphasis = false,
  }) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 14),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            width: 38,
            height: 38,
            decoration: BoxDecoration(
              color: const Color(0xFF8224E3),
              borderRadius: BorderRadius.circular(14),
            ),
            child: const Icon(Icons.support_agent_rounded, color: Color(0xFFFFFFFF), size: 20),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Container(
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                color: const Color(0xFFFFFFFF),
                borderRadius: BorderRadius.circular(22),
                border: Border.all(color: const Color(0x228224E3)),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    speaker,
                    style: const TextStyle(color: Color(0xFF8224E3), fontWeight: FontWeight.w800, fontSize: 12),
                  ),
                  const SizedBox(height: 8),
                  Text(
                    text,
                    style: TextStyle(
                      color: const Color(0xFF131313),
                      height: 1.45,
                      fontWeight: emphasis ? FontWeight.w800 : FontWeight.w600,
                      fontSize: emphasis ? 18 : 14,
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

  Widget _sectionCard({required String title, required Widget child}) {
    return AppCard(
      color: const Color(0xFFFFFFFF),
      borderColor: const Color(0x228224E3),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(title, style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 20, color: Color(0xFF131313))),
          const SizedBox(height: 14),
          child,
        ],
      ),
    );
  }

  Widget _detailRow(String label, String value, {bool last = false}) {
    return Container(
      padding: const EdgeInsets.symmetric(vertical: 12),
      decoration: BoxDecoration(
        border: Border(bottom: last ? BorderSide.none : const BorderSide(color: Color(0x228224E3))),
      ),
      child: Row(
        children: [
          Expanded(
            child: Text(label, style: const TextStyle(color: Color(0xFF6E6A67), fontWeight: FontWeight.w700)),
          ),
          const SizedBox(width: 12),
          Flexible(
            child: Text(
              value,
              textAlign: TextAlign.right,
              style: const TextStyle(color: Color(0xFF131313), fontWeight: FontWeight.w800),
            ),
          ),
        ],
      ),
    );
  }
}
