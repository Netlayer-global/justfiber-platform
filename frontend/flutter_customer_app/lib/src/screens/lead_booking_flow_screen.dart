import 'package:flutter/material.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:geolocator/geolocator.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:latlong2/latlong.dart';

import '../core/app_state.dart';
import '../core/theme.dart';

// New-user lead capture flow:
// Step 0 – Details & Location
// Step 1 – Choose Plan
// Step 2 – Choose Duration
// Step 3 – Review & Submit (creates a lead, no payment)

class LeadBookingFlowScreen extends StatefulWidget {
  const LeadBookingFlowScreen({super.key, this.initialMobile});
  final String? initialMobile;

  @override
  State<LeadBookingFlowScreen> createState() => _LeadBookingFlowScreenState();
}

class _LeadBookingFlowScreenState extends State<LeadBookingFlowScreen> {
  static const _slotOptions = [
    ('morning', '10 AM – 1 PM'),
    ('afternoon', '1 PM – 4 PM'),
    ('evening', '4 PM – 7 PM'),
  ];

  int step = 0;
  bool _submitting = false;
  bool _submitted = false;
  String? _leadNumber;

  // Address / details
  final _nameCtrl = TextEditingController();
  final _mobileCtrl = TextEditingController();
  final _emailCtrl = TextEditingController();
  final _addressCtrl = TextEditingController();
  final _pinCtrl = TextEditingController();

  // Location
  final MapController _mapCtrl = MapController();
  LatLng _location = const LatLng(28.6139, 77.2090);
  bool _locationPicked = false;
  bool _locationBusy = false;
  String? _locationError;
  bool _permDeniedForever = false;
  bool _serviceDisabled = false;

  // Plan / duration
  String? _planCode;
  int _durationMonths = 1;
  String _durationLabel = '1 month';

  // Slot
  String _slotCode = 'morning';
  String _slotLabel = '10 AM – 1 PM';

  @override
  void initState() {
    super.initState();
    _mobileCtrl.text = widget.initialMobile ?? '';
    // Load plans immediately since plan selection is step 0
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) return;
      final appState = AppStateScope.of(context);
      if (appState.plans.isEmpty) {
        appState.refreshPlans();
      }
    });
  }

  @override
  void dispose() {
    _nameCtrl.dispose();
    _mobileCtrl.dispose();
    _emailCtrl.dispose();
    _addressCtrl.dispose();
    _pinCtrl.dispose();
    super.dispose();
  }

  // ── Build ──────────────────────────────────────────────────────────────────

  @override
  Widget build(BuildContext context) {
    final appState = AppStateScope.of(context);
    final plans = appState.plans;
    final selectedPlan = plans.cast<dynamic>().where(
          (p) => p.planCode == _planCode).firstOrNull;

    if (_mobileCtrl.text.isEmpty && (widget.initialMobile ?? '').isNotEmpty) {
      _mobileCtrl.text = widget.initialMobile!;
    }

    return Scaffold(
      backgroundColor: kBg,
      body: Column(
        children: [
          _Header(step: step, planName: selectedPlan?.name),
          Expanded(
            child: RefreshIndicator(
              color: kPrimary,
              backgroundColor: kSurface,
              onRefresh: appState.refresh,
              child: ListView(
                padding: const EdgeInsets.fromLTRB(18, 18, 18, 48),
                children: [
                  if (!_submitted) _stepper(),
                  const SizedBox(height: 20),
                  if (_submitted)
                    _successStep()
                  else if (step == 0)
                    _planStep(appState, plans)
                  else if (step == 1)
                    _durationStep(selectedPlan)
                  else if (step == 2)
                    _detailsStep(appState)
                  else if (step == 3)
                    _reviewStep(appState, selectedPlan),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }

  // ── Steps ──────────────────────────────────────────────────────────────────

  Widget _detailsStep(AppState appState) {
    return _card(
      title: 'Your details',
      subtitle: 'Enter your info and pin your installation location',
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          _checklist(),
          const SizedBox(height: 18),
          _field('Full name', _nameCtrl, icon: Icons.person_outline_rounded),
          const SizedBox(height: 12),
          _field('Mobile number', _mobileCtrl,
              icon: Icons.phone_outlined, type: TextInputType.phone),
          const SizedBox(height: 12),
          _field('Email (optional)', _emailCtrl,
              icon: Icons.mail_outline_rounded,
              type: TextInputType.emailAddress),
          const SizedBox(height: 12),
          _field('Installation address', _addressCtrl,
              icon: Icons.home_outlined, maxLines: 3),
          const SizedBox(height: 12),
          _field('Pin code', _pinCtrl,
              icon: Icons.pin_drop_outlined, type: TextInputType.number),
          const SizedBox(height: 18),

          // Location button
          SizedBox(
            width: double.infinity,
            child: FilledButton.icon(
              onPressed: _locationBusy ? null : _fetchLocation,
              icon: _locationBusy
                  ? const SizedBox(
                      width: 16,
                      height: 16,
                      child: CircularProgressIndicator(
                          color: Colors.white, strokeWidth: 2),
                    )
                  : const Icon(Icons.my_location_rounded, size: 18),
              label: Text(
                _locationBusy ? 'Fetching location…' : 'Use current location',
                style: GoogleFonts.inter(fontWeight: FontWeight.w700),
              ),
              style: FilledButton.styleFrom(
                backgroundColor: kSurface2,
                foregroundColor: Colors.white,
                side: BorderSide(color: kPrimary.withValues(alpha: 0.3)),
                padding: const EdgeInsets.symmetric(vertical: 14),
                shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(14)),
              ),
            ),
          ),

          const SizedBox(height: 14),

          // Map
          Container(
            height: 300,
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(22),
              border: Border.all(
                  color: _locationPicked
                      ? kPrimary.withValues(alpha: 0.5)
                      : kPrimary.withValues(alpha: 0.2)),
            ),
            clipBehavior: Clip.antiAlias,
            child: Stack(
              children: [
                FlutterMap(
                  mapController: _mapCtrl,
                  options: MapOptions(
                    initialCenter: _location,
                    initialZoom: 16,
                    onTap: (_, point) => setState(() {
                      _location = point;
                      _locationPicked = true;
                      _locationError = null;
                    }),
                  ),
                  children: [
                    TileLayer(
                      urlTemplate:
                          'https://a.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}@2x.png',
                      userAgentPackageName: 'com.justfiber.customer',
                    ),
                    MarkerLayer(markers: [
                      Marker(
                        point: _location,
                        width: 48,
                        height: 48,
                        child: const Icon(Icons.location_pin,
                            size: 42, color: Color(0xFFEF4444)),
                      ),
                    ]),
                  ],
                ),
                if (!_locationPicked)
                  Positioned(
                    top: 12,
                    left: 12,
                    right: 12,
                    child: _mapHint(
                        Icons.touch_app_rounded,
                        'Tap on the map to pin your installation location'),
                  ),
                if (_locationPicked)
                  Positioned(
                    bottom: 12,
                    left: 12,
                    right: 12,
                    child: _mapBadge(),
                  ),
              ],
            ),
          ),

          if ((_locationError ?? '').isNotEmpty) ...[
            const SizedBox(height: 10),
            _errorBanner(_locationError!),
            const SizedBox(height: 8),
            Wrap(spacing: 8, runSpacing: 8, children: [
              if (_serviceDisabled)
                _ghostBtn('Location settings', Geolocator.openLocationSettings),
              if (_permDeniedForever)
                _ghostBtn('App settings', Geolocator.openAppSettings),
              _ghostBtn('Try again',
                  _locationBusy ? null : _fetchLocation),
            ]),
          ],

          const SizedBox(height: 20),
          _primaryBtn(
            label: 'Review & Submit',
            onPressed: _validateDetails()
                ? () => setState(() => step = 3)
                : null,
          ),
          const SizedBox(height: 10),
          _backBtn('Back to Duration', () => setState(() => step = 1)),
        ],
      ),
    );
  }

  Widget _planStep(AppState appState, List<dynamic> plans) {
    // Group plans by speed — one card per speed tier
    final speedMap = <int, List<dynamic>>{};
    for (final p in plans) {
      int speed = (p.speedMbps as num).round();
      // Fallback: parse speed from plan name if speedMbps is 0
      if (speed == 0) {
        final match = RegExp(r'(\d+)\s*[Mm]').firstMatch(p.name as String);
        if (match != null) speed = int.tryParse(match.group(1)!) ?? 0;
      }
      speedMap.putIfAbsent(speed, () => []).add(p);
    }
    final speedGroups = speedMap.entries.toList()
      ..sort((a, b) => a.key.compareTo(b.key));

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          'Choose a plan',
          style: GoogleFonts.inter(
            color: kText,
            fontSize: 20,
            fontWeight: FontWeight.w800,
            letterSpacing: -0.4,
          ),
        ),
        const SizedBox(height: 4),
        Text(
          'Select the speed that suits your needs',
          style: GoogleFonts.inter(
            color: kTextMuted,
            fontSize: 13,
            fontWeight: FontWeight.w500,
          ),
        ),
        const SizedBox(height: 18),
        if (plans.isEmpty) ...[
          Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
                color: kSurface,
                borderRadius: BorderRadius.circular(kRSurface),
                border: Border.all(color: kBorderSoft)),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text('Loading plans…',
                    style: GoogleFonts.inter(
                        color: kText, fontWeight: FontWeight.w700)),
                const SizedBox(height: 10),
                _primaryBtn(
                    label: 'Reload',
                    onPressed: () async => await appState.refreshPlans()),
              ],
            ),
          ),
        ] else ...[
          for (final entry in speedGroups) ...[
            _speedGroupCard(entry.key, entry.value),
            const SizedBox(height: 14),
          ],
        ],
        const SizedBox(height: 8),
        _primaryBtn(
          label: 'Continue to Duration',
          onPressed: _planCode != null
              ? () {
                  final sel = plans.cast<dynamic>().where(
                        (p) => p.planCode == _planCode).firstOrNull;
                  if (sel != null) {
                    final durs = _durations(sel);
                    _durationMonths = durs.first.$1;
                    _durationLabel = durs.first.$2;
                  }
                  setState(() => step = 1);
                }
              : null,
        ),
      ],
    );
  }

  Widget _speedGroupCard(int speedMbps, List<dynamic> plans) {
    final representative = plans.first;
    final isSelected = plans.any((p) => p.planCode == _planCode);
    final bannerUrl = (representative.bannerImageUrl ?? '') as String;
    final lowestPrice = plans
        .map((p) => (p.monthlyPrice as num).toDouble())
        .reduce((a, b) => a < b ? a : b);
    final dataPolicy = (representative.dataPolicy ?? 'unlimited') as String;
    final badges = <String>[
      if (representative.recommended == true) 'Recommended',
      if (dataPolicy == 'unlimited') 'Unlimited',
      if (representative.routerIncluded == true) 'Router Included',
    ];

    return GestureDetector(
      onTap: () {
        // Select plan and go to duration step
        setState(() => _planCode = representative.planCode as String);
        final durs = _durations(representative);
        _durationMonths = durs.first.$1;
        _durationLabel = durs.first.$2;
        setState(() => step = 1);
      },
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 200),
        decoration: BoxDecoration(
          color: kSurface,
          borderRadius: BorderRadius.circular(kRCard),
          border: Border.all(
            color: isSelected ? kAccent : kBorderSoft,
            width: isSelected ? 1.5 : 1,
          ),
          boxShadow: isSelected
              ? [
                  BoxShadow(
                    color: kAccent.withValues(alpha: 0.25),
                    blurRadius: 16,
                    offset: const Offset(0, 6),
                  ),
                ]
              : null,
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Banner image (if available)
            if (bannerUrl.isNotEmpty)
              ClipRRect(
                borderRadius:
                    const BorderRadius.vertical(top: Radius.circular(28)),
                child: Image.network(
                  bannerUrl,
                  height: 120,
                  width: double.infinity,
                  fit: BoxFit.cover,
                  errorBuilder: (_, __, ___) => const SizedBox.shrink(),
                ),
              ),

            Padding(
              padding: const EdgeInsets.fromLTRB(16, 14, 16, 16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  // Badges
                  if (badges.isNotEmpty)
                    Padding(
                      padding: const EdgeInsets.only(bottom: 10),
                      child: Wrap(
                        spacing: 6,
                        runSpacing: 4,
                        children: badges
                            .map((b) => Container(
                                  padding: const EdgeInsets.symmetric(
                                      horizontal: 8, vertical: 3),
                                  decoration: BoxDecoration(
                                    color: kAccentSoft,
                                    borderRadius:
                                        BorderRadius.circular(kRPill),
                                  ),
                                  child: Text(
                                    b,
                                    style: GoogleFonts.inter(
                                      color: kAccent,
                                      fontSize: 9,
                                      fontWeight: FontWeight.w800,
                                    ),
                                  ),
                                ))
                            .toList(),
                      ),
                    ),

                  // Price + Speed + Data row (Airtel style)
                  Row(
                    crossAxisAlignment: CrossAxisAlignment.end,
                    children: [
                      Row(
                        crossAxisAlignment: CrossAxisAlignment.baseline,
                        textBaseline: TextBaseline.alphabetic,
                        children: [
                          Text(
                            '₹${lowestPrice.toStringAsFixed(0)}',
                            style: GoogleFonts.inter(
                              color: kText,
                              fontSize: 24,
                              fontWeight: FontWeight.w900,
                              letterSpacing: -0.5,
                            ),
                          ),
                          Text(
                            ' /m +GST',
                            style: GoogleFonts.inter(
                              color: kTextMuted,
                              fontSize: 11,
                              fontWeight: FontWeight.w600,
                            ),
                          ),
                        ],
                      ),
                      const Spacer(),
                      Column(
                        children: [
                          Text(
                            '$speedMbps Mbps',
                            style: GoogleFonts.inter(
                              color: kText,
                              fontSize: 14,
                              fontWeight: FontWeight.w800,
                            ),
                          ),
                          Text(
                            'Speed',
                            style: GoogleFonts.inter(
                              color: kTextMuted,
                              fontSize: 10,
                              fontWeight: FontWeight.w600,
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(width: 16),
                      Column(
                        children: [
                          Text(
                            dataPolicy == 'unlimited'
                                ? 'Unlimited'
                                : dataPolicy.toUpperCase(),
                            style: GoogleFonts.inter(
                              color: kText,
                              fontSize: 14,
                              fontWeight: FontWeight.w800,
                            ),
                          ),
                          Text(
                            'Internet',
                            style: GoogleFonts.inter(
                              color: kTextMuted,
                              fontSize: 10,
                              fontWeight: FontWeight.w600,
                            ),
                          ),
                        ],
                      ),
                    ],
                  ),

                  // Select Plan button (like upgrade screen)
                  const SizedBox(height: 14),
                  Container(
                    width: double.infinity,
                    padding: const EdgeInsets.symmetric(vertical: 13),
                    decoration: BoxDecoration(
                      color: isSelected ? kAccent : kSurface,
                      borderRadius: BorderRadius.circular(kRSmall),
                      border: isSelected
                          ? null
                          : Border.all(color: kBorderSoft),
                      boxShadow: isSelected
                          ? [
                              BoxShadow(
                                color: kAccent.withValues(alpha: 0.35),
                                blurRadius: 10,
                                offset: const Offset(0, 4),
                              ),
                            ]
                          : null,
                    ),
                    child: Center(
                      child: Text(
                        isSelected ? '✓ Selected' : 'Select Plan',
                        style: GoogleFonts.inter(
                          color: isSelected ? Colors.white : kText,
                          fontSize: 13,
                          fontWeight: FontWeight.w800,
                        ),
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

  Widget _durationStep(dynamic selectedPlan) {
    // Build durations from ALL plans in the same speed group
    final appState = AppStateScope.of(context);
    final allPlans = appState.plans;
    
    // Determine speed of selected plan
    int selectedSpeed = 0;
    if (selectedPlan != null) {
      selectedSpeed = (selectedPlan.speedMbps as num).round();
      if (selectedSpeed == 0) {
        final match = RegExp(r'(\d+)\s*[Mm]').firstMatch(selectedPlan.name as String);
        if (match != null) selectedSpeed = int.tryParse(match.group(1)!) ?? 0;
      }
    }

    // Get all plans in this speed group (same logic as _planStep grouping)
    final groupPlans = allPlans.where((p) {
      int speed = p.speedMbps.round();
      if (speed == 0) {
        final match = RegExp(r'(\d+)\s*[Mm]').firstMatch(p.name);
        if (match != null) speed = int.tryParse(match.group(1)!) ?? 0;
      }
      return speed == selectedSpeed;
    }).toList()
      ..sort((a, b) => a.billingPeriodMonths.compareTo(b.billingPeriodMonths));

    // Build duration options from group plans (each plan = one duration)
    final durations = <(int, String, double, String)>[]; // (months, label, price, planCode)
    for (final p in groupPlans) {
      final months = p.billingPeriodMonths > 0 ? p.billingPeriodMonths : 1;
      final label = months == 1
          ? '1 month'
          : months == 3
              ? '3 months'
              : months == 6
                  ? '6 months'
                  : months == 12
                      ? '12 months'
                      : '$months months';
      durations.add((months.round(), label, p.monthlyPrice, p.planCode));
    }
    // Deduplicate by months (keep first/cheapest)
    final seen = <int>{};
    durations.retainWhere((d) => seen.add(d.$1));

    if (durations.isEmpty) durations.add((1, '1 month', selectedPlan?.monthlyPrice ?? 0.0, _planCode ?? ''));

    final setup = selectedPlan == null
        ? 0.0
        : ((selectedPlan.otcCharge ?? 0) as num).toDouble() +
            ((selectedPlan.installationCharge ?? 0) as num).toDouble();

    return _card(
      title: 'Choose duration',
      subtitle: '$selectedSpeed Mbps plan — select billing period',
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          for (final opt in durations) ...[
            _durationTile(
              label: opt.$2,
              recurring: opt.$3,
              setup: setup,
              selected: _durationMonths == opt.$1,
              onTap: () => setState(() {
                _durationMonths = opt.$1;
                _durationLabel = opt.$2;
                _planCode = opt.$4; // Switch to the correct plan for this duration
              }),
            ),
            const SizedBox(height: 10),
          ],
          const SizedBox(height: 4),

          // Preferred slot
          Text('Preferred install slot',
              style: GoogleFonts.inter(
                  color: Colors.white,
                  fontWeight: FontWeight.w800,
                  fontSize: 14)),
          const SizedBox(height: 10),
          for (final slot in _slotOptions) ...[
            _slotTile(slot.$1, slot.$2),
            const SizedBox(height: 8),
          ],
          const SizedBox(height: 8),

          _summaryBox([
            ('Plan', '$selectedSpeed Mbps · ${_durationLabel}'),
            ('Duration', _durationLabel),
            ('Amount', 'Rs ${durations.where((d) => d.$1 == _durationMonths).firstOrNull?.$3.toStringAsFixed(0) ?? "—"}'),
            if (setup > 0) ('Setup', 'Rs ${setup.toStringAsFixed(0)}'),
            ('Preferred slot', _slotLabel),
          ]),
          const SizedBox(height: 16),

          _primaryBtn(
            label: 'Continue',
            onPressed: () {
              if (!_locationPicked && !_locationBusy) _fetchLocation();
              setState(() => step = 2);
            },
          ),
          const SizedBox(height: 10),
          _backBtn('Back to Plans', () => setState(() => step = 0)),
        ],
      ),
    );
  }

  Widget _reviewStep(AppState appState, dynamic selectedPlan) {
    return _card(
      title: 'Review & Submit',
      subtitle: 'Our team will contact you to confirm',
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          _summaryBox([
            ('Name', _nameCtrl.text.trim().isEmpty ? '—' : _nameCtrl.text.trim()),
            ('Mobile', _mobileCtrl.text.trim()),
            if (_emailCtrl.text.trim().isNotEmpty)
              ('Email', _emailCtrl.text.trim()),
            ('Address', _addressCtrl.text.trim().isEmpty
                ? '—'
                : _addressCtrl.text.trim()),
            ('Pin code', _pinCtrl.text.trim()),
            ('Plan', selectedPlan?.name ?? '—'),
            ('Duration', _durationLabel),
            ('Preferred slot', _slotLabel),
          ]),

          const SizedBox(height: 16),

          // Info banner
          Container(
            padding: const EdgeInsets.all(14),
            decoration: BoxDecoration(
              color: kPrimary.withValues(alpha: 0.08),
              borderRadius: BorderRadius.circular(14),
              border: Border.all(color: kPrimary.withValues(alpha: 0.25)),
            ),
            child: Row(
              children: [
                const Icon(Icons.info_outline_rounded,
                    color: kPrimaryLight, size: 16),
                const SizedBox(width: 10),
                Expanded(
                  child: Text(
                    'Submitting this creates an enquiry. Our team will call you to complete the booking.',
                    style: GoogleFonts.inter(
                        color: kPrimaryLight,
                        fontSize: 12,
                        height: 1.45,
                        fontWeight: FontWeight.w600),
                  ),
                ),
              ],
            ),
          ),

          const SizedBox(height: 18),
          _primaryBtn(
            label: _submitting ? 'Submitting…' : 'Confirm Booking Request',
            onPressed: _submitting ? null : () => _submit(appState, selectedPlan),
          ),
          const SizedBox(height: 10),
          _backBtn('Back to Details', () => setState(() => step = 2)),
        ],
      ),
    );
  }

  Widget _successStep() {
    return Container(
      padding: const EdgeInsets.all(28),
      decoration: BoxDecoration(
        color: kSurface,
        borderRadius: BorderRadius.circular(24),
        border: Border.all(color: const Color(0x44D8B4FE)),
      ),
      child: Column(
        children: [
          Container(
            width: 80,
            height: 80,
            decoration: BoxDecoration(
              gradient: const LinearGradient(
                colors: [Color(0xFFBB6FF7), Color(0xFF7C3AED)],
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
              ),
              shape: BoxShape.circle,
              boxShadow: [
                BoxShadow(
                  color: kPrimary.withValues(alpha: 0.4),
                  blurRadius: 24,
                  offset: const Offset(0, 6),
                ),
              ],
            ),
            child: const Icon(Icons.check_rounded, color: Colors.white, size: 38),
          ),
          const SizedBox(height: 22),
          Text(
            'Enquiry submitted!',
            textAlign: TextAlign.center,
            style: GoogleFonts.inter(
                color: Colors.white,
                fontWeight: FontWeight.w900,
                fontSize: 24,
                letterSpacing: -0.5),
          ),
          const SizedBox(height: 10),
          if (_leadNumber != null) ...[
            Container(
              padding:
                  const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
              decoration: BoxDecoration(
                color: kPrimary.withValues(alpha: 0.12),
                borderRadius: BorderRadius.circular(10),
                border:
                    Border.all(color: kPrimary.withValues(alpha: 0.3)),
              ),
              child: Text(
                'Lead: $_leadNumber',
                style: GoogleFonts.inter(
                    color: kPrimaryLight,
                    fontWeight: FontWeight.w800,
                    fontSize: 14),
              ),
            ),
            const SizedBox(height: 12),
          ],
          Text(
            'We have received your enquiry for ${_nameCtrl.text.trim()}.\nOur team will contact you on ${_mobileCtrl.text.trim()} to confirm your installation.',
            textAlign: TextAlign.center,
            style:
                GoogleFonts.inter(color: kMuted, height: 1.6, fontSize: 14),
          ),
          const SizedBox(height: 24),

          // What next
          Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: kBg,
              borderRadius: BorderRadius.circular(16),
              border: Border.all(color: kBorder),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text('What happens next?',
                    style: GoogleFonts.inter(
                        color: Colors.white,
                        fontWeight: FontWeight.w800,
                        fontSize: 14)),
                const SizedBox(height: 10),
                _nextItem('1', 'Our sales team reviews your enquiry.'),
                _nextItem(
                    '2', 'We call you to confirm availability and schedule.'),
                _nextItem(
                    '3', 'Installer visits and sets up your fiber connection.'),
              ],
            ),
          ),

          const SizedBox(height: 22),
          SizedBox(
            width: double.infinity,
            child: FilledButton(
              onPressed: () => Navigator.of(context).pop(),
              child: Text('Done',
                  style: GoogleFonts.inter(fontWeight: FontWeight.w700)),
            ),
          ),
        ],
      ),
    );
  }

  // ── Submit logic ───────────────────────────────────────────────────────────

  Future<void> _submit(AppState appState, dynamic selectedPlan) async {
    setState(() => _submitting = true);
    try {
      final leadNumber = await appState.submitConnectionLead(
        fullName: _nameCtrl.text.trim(),
        mobile: _mobileCtrl.text.trim(),
        email: _emailCtrl.text.trim().isEmpty ? null : _emailCtrl.text.trim(),
        address: _addressCtrl.text.trim(),
        pinCode: _pinCtrl.text.trim(),
        lat: _location.latitude,
        lng: _location.longitude,
        planCode: _planCode,
        planName: selectedPlan?.name as String?,
        durationMonths: _durationMonths,
        durationLabel: _durationLabel,
        preferredSlotCode: _slotCode,
        preferredSlotLabel: _slotLabel,
      );
      if (!mounted) return;
      setState(() {
        _submitting = false;
        _submitted = true;
        _leadNumber = leadNumber;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() => _submitting = false);
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(e.toString().replaceFirst('Exception: ', ''))),
      );
    }
  }

  // ── Validation ─────────────────────────────────────────────────────────────

  bool _validateDetails() {
    final name = _nameCtrl.text.trim();
    final mobile = _mobileCtrl.text.trim();
    final address = _addressCtrl.text.trim();
    final pin = _pinCtrl.text.trim();
    return name.length >= 2 &&
        mobile.length == 10 &&
        int.tryParse(mobile) != null &&
        address.length >= 5 &&
        pin.length >= 4 &&
        _locationPicked;
  }

  // ── Location ───────────────────────────────────────────────────────────────

  Future<void> _fetchLocation() async {
    setState(() {
      _locationBusy = true;
      _locationError = null;
      _permDeniedForever = false;
      _serviceDisabled = false;
    });
    try {
      final enabled = await Geolocator.isLocationServiceEnabled();
      if (!enabled) {
        setState(() => _serviceDisabled = true);
        throw Exception('Location services are off. Please enable them.');
      }
      var perm = await Geolocator.checkPermission();
      if (perm == LocationPermission.denied) {
        perm = await Geolocator.requestPermission();
      }
      if (perm == LocationPermission.deniedForever) {
        setState(() => _permDeniedForever = true);
        throw Exception(
            'Location permission permanently denied. Open app settings.');
      }
      if (perm == LocationPermission.denied) {
        throw Exception('Location permission denied.');
      }
      final pos = await Geolocator.getCurrentPosition(
          locationSettings:
              const LocationSettings(accuracy: LocationAccuracy.high));
      setState(() {
        _location = LatLng(pos.latitude, pos.longitude);
        _locationPicked = true;
      });
      _mapCtrl.move(_location, 17);
    } catch (e) {
      setState(() {
        _locationError = e.toString().replaceFirst('Exception: ', '');
      });
    } finally {
      if (mounted) setState(() => _locationBusy = false);
    }
  }

  // ── Stepper ────────────────────────────────────────────────────────────────

  Widget _stepper() {
    const labels = ['Details', 'Plan', 'Duration', 'Review'];
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: kSurface,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: kBorder),
      ),
      child: Row(
        children: List.generate(labels.length, (i) {
          final active = i <= step;
          final current = i == step;
          final isLast = i == labels.length - 1;
          return Expanded(
            child: Row(
              children: [
                Expanded(
                  child: Column(
                    children: [
                      AnimatedContainer(
                        duration: const Duration(milliseconds: 250),
                        width: 30,
                        height: 30,
                        decoration: BoxDecoration(
                          gradient: active
                              ? const LinearGradient(
                                  colors: [Color(0xFFBB6FF7), Color(0xFF7C3AED)],
                                  begin: Alignment.topLeft,
                                  end: Alignment.bottomRight,
                                )
                              : null,
                          color: active ? null : kSurface2,
                          shape: BoxShape.circle,
                          border: Border.all(
                            color: active ? Colors.transparent : kBorder,
                          ),
                          boxShadow: current
                              ? [
                                  BoxShadow(
                                    color: kPrimary.withValues(alpha: 0.4),
                                    blurRadius: 10,
                                    spreadRadius: 1,
                                  )
                                ]
                              : null,
                        ),
                        child: Center(
                          child: active && !current
                              ? const Icon(Icons.check_rounded,
                                  size: 14, color: Colors.white)
                              : Text(
                                  '${i + 1}',
                                  style: GoogleFonts.inter(
                                    color: active ? Colors.white : kMuted,
                                    fontSize: 11,
                                    fontWeight: FontWeight.w800,
                                  ),
                                ),
                        ),
                      ),
                      const SizedBox(height: 6),
                      Text(
                        labels[i],
                        textAlign: TextAlign.center,
                        style: GoogleFonts.inter(
                          fontSize: 9,
                          fontWeight:
                              current ? FontWeight.w800 : FontWeight.w500,
                          color: active ? Colors.white : kMuted,
                        ),
                      ),
                    ],
                  ),
                ),
                if (!isLast)
                  Expanded(
                    child: Container(
                      height: 2,
                      margin: const EdgeInsets.only(bottom: 20),
                      decoration: BoxDecoration(
                        gradient: i < step
                            ? const LinearGradient(colors: [
                                Color(0xFFBB6FF7),
                                Color(0xFF7C3AED)
                              ])
                            : null,
                        color: i < step ? null : kBorder,
                        borderRadius: BorderRadius.circular(2),
                      ),
                    ),
                  ),
              ],
            ),
          );
        }),
      ),
    );
  }

  // ── UI widgets ─────────────────────────────────────────────────────────────

  Widget _card({
    required String title,
    required String subtitle,
    required Widget child,
  }) =>
      Container(
        padding: const EdgeInsets.all(22),
        decoration: BoxDecoration(
          color: kSurface,
          borderRadius: BorderRadius.circular(24),
          border: Border.all(color: kPrimary.withValues(alpha: 0.15)),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(title,
                style: GoogleFonts.inter(
                    color: Colors.white,
                    fontSize: 20,
                    fontWeight: FontWeight.w900,
                    letterSpacing: -0.4)),
            const SizedBox(height: 4),
            Text(subtitle,
                style: GoogleFonts.inter(color: kMuted, fontSize: 13)),
            const SizedBox(height: 20),
            child,
          ],
        ),
      );

  Widget _checklist() => Container(
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(
          color: kSurface2,
          borderRadius: BorderRadius.circular(14),
          border: Border.all(color: kPrimary.withValues(alpha: 0.12)),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text('Complete before continuing',
                style: GoogleFonts.inter(
                    color: Colors.white,
                    fontWeight: FontWeight.w800,
                    fontSize: 13)),
            const SizedBox(height: 10),
            _checkItem('Full name', _nameCtrl.text.trim().length >= 2),
            _checkItem('Mobile (10 digits)',
                _mobileCtrl.text.trim().length == 10),
            _checkItem(
                'Address', _addressCtrl.text.trim().length >= 5),
            _checkItem('Pin code', _pinCtrl.text.trim().length >= 4),
            _checkItem('Map pin dropped', _locationPicked),
          ],
        ),
      );

  Widget _checkItem(String label, bool done) => Padding(
        padding: const EdgeInsets.only(bottom: 8),
        child: Row(
          children: [
            Icon(
              done
                  ? Icons.check_circle_rounded
                  : Icons.radio_button_unchecked_rounded,
              size: 16,
              color: done ? const Color(0xFF4ADE80) : kMuted,
            ),
            const SizedBox(width: 8),
            Text(label,
                style: GoogleFonts.inter(
                    color: done ? Colors.white : kMuted,
                    fontWeight: FontWeight.w600,
                    fontSize: 13)),
          ],
        ),
      );

  Widget _field(
    String label,
    TextEditingController ctrl, {
    int maxLines = 1,
    TextInputType type = TextInputType.text,
    IconData? icon,
  }) =>
      StatefulBuilder(
        builder: (_, setLocal) => TextField(
          controller: ctrl,
          maxLines: maxLines,
          keyboardType: type,
          onChanged: (_) => setState(() {}),
          style: GoogleFonts.inter(color: Colors.white, fontSize: 14),
          decoration: InputDecoration(
            labelText: label,
            labelStyle: GoogleFonts.inter(color: kMuted, fontSize: 13),
            prefixIcon:
                icon != null ? Icon(icon, size: 18, color: kMuted) : null,
            filled: true,
            fillColor: kSurface2,
            contentPadding:
                const EdgeInsets.symmetric(horizontal: 18, vertical: 14),
            border: OutlineInputBorder(
              borderRadius: BorderRadius.circular(16),
              borderSide: BorderSide(color: kPrimary.withValues(alpha: 0.2)),
            ),
            enabledBorder: OutlineInputBorder(
              borderRadius: BorderRadius.circular(16),
              borderSide: BorderSide(color: kPrimary.withValues(alpha: 0.2)),
            ),
            focusedBorder: OutlineInputBorder(
              borderRadius: BorderRadius.circular(16),
              borderSide: BorderSide(color: kPrimary.withValues(alpha: 0.6)),
            ),
          ),
        ),
      );

  Widget _planTile(dynamic plan) {
    final sel = _planCode == plan.planCode;
    return GestureDetector(
      onTap: () => setState(() => _planCode = plan.planCode as String),
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 200),
        padding: const EdgeInsets.all(18),
        decoration: BoxDecoration(
          color: sel ? const Color(0xFF8224E3) : kSurface2,
          borderRadius: BorderRadius.circular(20),
          border: Border.all(
            color: sel
                ? const Color(0x88D8B4FE)
                : kPrimary.withValues(alpha: 0.12),
            width: sel ? 1.5 : 1,
          ),
          boxShadow: sel
              ? [
                  BoxShadow(
                      color: kPrimary.withValues(alpha: 0.3),
                      blurRadius: 20,
                      offset: const Offset(0, 6))
                ]
              : null,
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Expanded(
                  child: Text(
                    plan.name as String,
                    style: GoogleFonts.inter(
                        color: Colors.white,
                        fontWeight: FontWeight.w900,
                        fontSize: 17,
                        letterSpacing: -0.3),
                  ),
                ),
                Container(
                  padding:
                      const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                  decoration: BoxDecoration(
                    color: sel
                        ? Colors.white.withValues(alpha: 0.18)
                        : kPrimary.withValues(alpha: 0.1),
                    borderRadius: BorderRadius.circular(999),
                    border: Border.all(
                        color: sel
                            ? Colors.white.withValues(alpha: 0.3)
                            : kPrimary.withValues(alpha: 0.3)),
                  ),
                  child: Text(
                    sel ? 'Selected ✓' : 'Select',
                    style: GoogleFonts.inter(
                        color: sel ? Colors.white : kPrimary,
                        fontSize: 11,
                        fontWeight: FontWeight.w700),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 12),
            Text(
              'Rs ${(plan.monthlyPrice as num).toStringAsFixed(0)} / month',
              style: GoogleFonts.inter(
                  color: Colors.white,
                  fontWeight: FontWeight.w900,
                  fontSize: 20,
                  letterSpacing: -0.5),
            ),
            const SizedBox(height: 10),
            Row(
              children: [
                _stat('${(plan.speedMbps as num).toStringAsFixed(0)} Mbps',
                    'Download'),
                _statDiv(),
                _stat(
                    '${(plan.uploadSpeedMbps as num).toStringAsFixed(0)} Mbps',
                    'Upload'),
                _statDiv(),
                _stat(
                    plan.dataPolicy == 'unlimited'
                        ? 'Unlimited'
                        : '${(plan.dataLimitGb as num).toStringAsFixed(0)} GB',
                    'Data'),
              ],
            ),
          ],
        ),
      ),
    );
  }

  Widget _stat(String val, String label) => Expanded(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(val,
                style: GoogleFonts.inter(
                    color: Colors.white,
                    fontWeight: FontWeight.w800,
                    fontSize: 12)),
            Text(label,
                style: GoogleFonts.inter(color: Colors.white60, fontSize: 10)),
          ],
        ),
      );

  Widget _statDiv() => Container(
      width: 1,
      height: 26,
      margin: const EdgeInsets.symmetric(horizontal: 8),
      color: Colors.white.withValues(alpha: 0.12));

  Widget _durationTile({
    required String label,
    required double recurring,
    required double setup,
    required bool selected,
    required VoidCallback onTap,
  }) =>
      GestureDetector(
        onTap: onTap,
        child: AnimatedContainer(
          duration: const Duration(milliseconds: 200),
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
            color: selected ? const Color(0xFF8224E3) : kSurface2,
            borderRadius: BorderRadius.circular(18),
            border: Border.all(
              color: selected
                  ? const Color(0x88D8B4FE)
                  : kPrimary.withValues(alpha: 0.12),
            ),
          ),
          child: Row(
            children: [
              Container(
                width: 22,
                height: 22,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  color: selected ? kPrimary : Colors.transparent,
                  border: Border.all(
                    color:
                        selected ? kPrimary : kMuted.withValues(alpha: 0.4),
                    width: 2,
                  ),
                ),
                child: selected
                    ? const Icon(Icons.check_rounded,
                        size: 12, color: Colors.white)
                    : null,
              ),
              const SizedBox(width: 14),
              Expanded(
                child: Text(label,
                    style: GoogleFonts.inter(
                        color: Colors.white,
                        fontWeight: FontWeight.w700,
                        fontSize: 15)),
              ),
              Text(
                'Rs ${(recurring + setup).toStringAsFixed(0)}',
                style: GoogleFonts.inter(
                    color: Colors.white,
                    fontWeight: FontWeight.w900,
                    fontSize: 15),
              ),
            ],
          ),
        ),
      );

  Widget _slotTile(String code, String label) {
    final sel = _slotCode == code;
    return GestureDetector(
      onTap: () => setState(() {
        _slotCode = code;
        _slotLabel = label;
      }),
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 200),
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
        decoration: BoxDecoration(
          color: sel ? kPrimary.withValues(alpha: 0.1) : kSurface2,
          borderRadius: BorderRadius.circular(14),
          border: Border.all(
            color: sel
                ? kPrimary.withValues(alpha: 0.4)
                : kPrimary.withValues(alpha: 0.1),
          ),
        ),
        child: Row(
          children: [
            Container(
              width: 20,
              height: 20,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                color: sel ? kPrimary : Colors.transparent,
                border: Border.all(
                    color: sel ? kPrimary : kMuted.withValues(alpha: 0.4),
                    width: 2),
              ),
              child: sel
                  ? const Icon(Icons.check_rounded,
                      size: 11, color: Colors.white)
                  : null,
            ),
            const SizedBox(width: 12),
            Text(label,
                style: GoogleFonts.inter(
                    color: Colors.white,
                    fontWeight: sel ? FontWeight.w700 : FontWeight.w500,
                    fontSize: 14)),
          ],
        ),
      ),
    );
  }

  Widget _summaryBox(List<(String, String)> rows) => Container(
        decoration: BoxDecoration(
          color: kSurface2,
          borderRadius: BorderRadius.circular(16),
          border: Border.all(color: kPrimary.withValues(alpha: 0.12)),
        ),
        child: Column(
          children: rows.asMap().entries.map((e) {
            final isLast = e.key == rows.length - 1;
            return Column(
              children: [
                Padding(
                  padding:
                      const EdgeInsets.symmetric(horizontal: 16, vertical: 11),
                  child: Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      SizedBox(
                        width: 110,
                        child: Text(e.value.$1,
                            style: GoogleFonts.inter(
                                color: kMuted, fontSize: 13)),
                      ),
                      const SizedBox(width: 8),
                      Expanded(
                        child: Text(e.value.$2,
                            textAlign: TextAlign.right,
                            style: GoogleFonts.inter(
                                color: Colors.white,
                                fontWeight: FontWeight.w700,
                                fontSize: 13)),
                      ),
                    ],
                  ),
                ),
                if (!isLast)
                  Divider(
                      height: 1,
                      color: kPrimary.withValues(alpha: 0.08),
                      indent: 16,
                      endIndent: 16),
              ],
            );
          }).toList(),
        ),
      );

  Widget _mapHint(IconData icon, String text) => Container(
        padding:
            const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
        decoration: BoxDecoration(
          color: const Color(0xF5050508),
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: kPrimary.withValues(alpha: 0.3)),
        ),
        child: Row(
          children: [
            Icon(icon, color: kPrimary, size: 14),
            const SizedBox(width: 8),
            Expanded(
              child: Text(text,
                  style: GoogleFonts.inter(
                      color: Colors.white,
                      fontSize: 11,
                      fontWeight: FontWeight.w600)),
            ),
          ],
        ),
      );

  Widget _mapBadge() => Container(
        padding:
            const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
        decoration: BoxDecoration(
          color: const Color(0xF5050508),
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: kPrimary.withValues(alpha: 0.4)),
        ),
        child: Row(
          children: [
            Container(
              width: 8,
              height: 8,
              decoration: const BoxDecoration(
                  color: Color(0xFF4ADE80), shape: BoxShape.circle),
            ),
            const SizedBox(width: 8),
            Expanded(
              child: Text('Location pinned',
                  style: GoogleFonts.inter(
                      color: const Color(0xFF4ADE80),
                      fontSize: 11,
                      fontWeight: FontWeight.w700)),
            ),
            GestureDetector(
              onTap: () => setState(() {
                _locationPicked = false;
                _location = const LatLng(28.6139, 77.2090);
              }),
              child: Text('Reset',
                  style: GoogleFonts.inter(
                      color: kMuted,
                      fontSize: 11,
                      fontWeight: FontWeight.w700)),
            ),
          ],
        ),
      );

  Widget _errorBanner(String msg) => Container(
        padding: const EdgeInsets.all(12),
        decoration: BoxDecoration(
          color: const Color(0x18EF4444),
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: const Color(0x44EF4444)),
        ),
        child: Row(
          children: [
            const Icon(Icons.warning_rounded,
                color: Color(0xFFEF4444), size: 16),
            const SizedBox(width: 8),
            Expanded(
              child: Text(msg,
                  style: GoogleFonts.inter(
                      color: const Color(0xFFEF4444), fontSize: 13)),
            ),
          ],
        ),
      );

  Widget _nextItem(String number, String text) => Padding(
        padding: const EdgeInsets.only(bottom: 8),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Container(
              width: 22,
              height: 22,
              margin: const EdgeInsets.only(top: 1),
              decoration: BoxDecoration(
                color: kPrimary.withValues(alpha: 0.12),
                shape: BoxShape.circle,
                border: Border.all(color: kPrimary.withValues(alpha: 0.3)),
              ),
              child: Center(
                child: Text(number,
                    style: GoogleFonts.inter(
                        color: kPrimary,
                        fontSize: 10,
                        fontWeight: FontWeight.w800)),
              ),
            ),
            const SizedBox(width: 10),
            Expanded(
              child: Text(text,
                  style: GoogleFonts.inter(
                      color: kMuted, fontSize: 13, height: 1.4)),
            ),
          ],
        ),
      );

  Widget _primaryBtn({required String label, required VoidCallback? onPressed}) =>
      SizedBox(
        width: double.infinity,
        child: FilledButton(
          onPressed: onPressed,
          style: FilledButton.styleFrom(
            backgroundColor: kPrimary,
            foregroundColor: Colors.white,
            disabledBackgroundColor: kPrimary.withValues(alpha: 0.3),
            padding: const EdgeInsets.symmetric(vertical: 15),
            shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(16)),
          ),
          child: Text(label,
              style: GoogleFonts.inter(
                  fontWeight: FontWeight.w700, fontSize: 15)),
        ),
      );

  Widget _backBtn(String label, VoidCallback onPressed) => SizedBox(
        width: double.infinity,
        child: OutlinedButton(
          onPressed: onPressed,
          style: OutlinedButton.styleFrom(
            foregroundColor: Colors.white,
            side: BorderSide(color: kPrimary.withValues(alpha: 0.3)),
            padding: const EdgeInsets.symmetric(vertical: 14),
            shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(16)),
          ),
          child: Text(label,
              style: GoogleFonts.inter(
                  fontWeight: FontWeight.w600, fontSize: 14)),
        ),
      );

  Widget _ghostBtn(String label, VoidCallback? onPressed) => OutlinedButton(
        onPressed: onPressed,
        style: OutlinedButton.styleFrom(
          foregroundColor: Colors.white,
          side: BorderSide(color: kPrimary.withValues(alpha: 0.3)),
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
          shape:
              RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
        ),
        child: Text(label,
            style:
                GoogleFonts.inter(fontWeight: FontWeight.w600, fontSize: 13)),
      );

  // ── Data helpers ───────────────────────────────────────────────────────────

  List<(int, String)> _durations(dynamic plan) {
    final list = <(int, String)>[];
    if ((plan.validityMonthly as bool? ?? false) ||
        (plan.monthlyPrice as num) > 0) { list.add((1, '1 month')); }
    if ((plan.validityQuarterly as bool? ?? false) ||
        (plan.quarterlyPrice as num) > 0) { list.add((3, '3 months')); }
    if ((plan.validityHalfYearly as bool? ?? false) ||
        (plan.halfYearlyPrice as num) > 0) { list.add((6, '6 months')); }
    if ((plan.validityYearly as bool? ?? false) ||
        (plan.yearlyPrice as num) > 0) { list.add((12, '12 months')); }
    if (list.isEmpty) list.add((1, '1 month'));
    return list;
  }

  double _priceFor(dynamic plan, int months) {
    final mp = (plan.monthlyPrice as num).toDouble();
    switch (months) {
      case 12:
        final yp = (plan.yearlyPrice as num).toDouble();
        return yp > 0 ? yp : mp * 12;
      case 6:
        final hp = (plan.halfYearlyPrice as num).toDouble();
        return hp > 0 ? hp : mp * 6;
      case 3:
        final qp = (plan.quarterlyPrice as num).toDouble();
        return qp > 0 ? qp : mp * 3;
      default:
        return mp;
    }
  }
}

// ── Header ─────────────────────────────────────────────────────────────────────

class _Header extends StatelessWidget {
  const _Header({required this.step, this.planName});
  final int step;
  final String? planName;

  static const _labels = ['Details & Location', 'Choose Plan', 'Duration', 'Review'];

  @override
  Widget build(BuildContext context) {
    return Container(
      color: const Color(0xFF8224E3),
      child: SafeArea(
        bottom: false,
        child: Padding(
          padding: const EdgeInsets.fromLTRB(6, 6, 18, 18),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.start,
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
                    const SizedBox(height: 12),
                    Text(
                      'Book Connection',
                      style: GoogleFonts.inter(
                        color: Colors.white,
                        fontSize: 22,
                        fontWeight: FontWeight.w900,
                        letterSpacing: -0.5,
                      ),
                    ),
                    const SizedBox(height: 3),
                    Text(
                      step < _labels.length
                          ? 'Step ${step + 1} of ${_labels.length} · ${_labels[step]}'
                          : 'Review your enquiry',
                      style:
                          GoogleFonts.inter(color: Colors.white60, fontSize: 13),
                    ),
                    if (planName != null) ...[
                      const SizedBox(height: 8),
                      Container(
                        padding: const EdgeInsets.symmetric(
                            horizontal: 10, vertical: 5),
                        decoration: BoxDecoration(
                          color: Colors.white.withValues(alpha: 0.13),
                          borderRadius: BorderRadius.circular(999),
                          border: Border.all(
                              color: Colors.white.withValues(alpha: 0.2)),
                        ),
                        child: Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            const Icon(Icons.wifi_rounded,
                                size: 11, color: Colors.white70),
                            const SizedBox(width: 5),
                            Text(planName!,
                                style: GoogleFonts.inter(
                                    color: Colors.white,
                                    fontSize: 11,
                                    fontWeight: FontWeight.w600)),
                          ],
                        ),
                      ),
                    ],
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

extension _FirstOrNull<T> on Iterable<T> {
  T? get firstOrNull {
    final it = iterator;
    return it.moveNext() ? it.current : null;
  }
}
