import 'package:flutter/material.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:geolocator/geolocator.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:latlong2/latlong.dart';

import '../core/app_state.dart';
import '../core/theme.dart';
import 'booking_payment_screen.dart';
import 'service_tracking_screen.dart';

class BookingFlowScreen extends StatefulWidget {
  const BookingFlowScreen({super.key, this.initialMobile});

  final String? initialMobile;

  @override
  State<BookingFlowScreen> createState() => _BookingFlowScreenState();
}

class _BookingFlowScreenState extends State<BookingFlowScreen> {
  static const _slotOptions = [
    ('morning', '10 AM – 1 PM'),
    ('afternoon', '1 PM – 4 PM'),
    ('evening', '4 PM – 7 PM'),
  ];

  int step = 0;
  String? selectedPlanCode;
  int _selectedDurationMonths = 1;
  String _selectedDurationLabel = '1 month';
  static const String _selectedPaymentMode = 'razorpay';
  String? _selectedSlotCode = 'morning';
  String? _selectedSlotLabel = '10 AM – 1 PM';
  DateTime _preferredDate = DateTime.now().add(const Duration(days: 1));
  final MapController _mapController = MapController();
  LatLng _selectedLocation = const LatLng(28.6139, 77.2090);
  bool _hasPickedLocation = false;
  bool _locationBusy = false;
  String? _locationError;
  bool _locationPermissionDeniedForever = false;
  bool _locationServiceDisabled = false;
  bool _usedCurrentLocation = false;
  bool _showUnavailableState = false;
  bool _draftHydrated = false;
  final nameController = TextEditingController();
  final mobileController = TextEditingController();
  final emailController = TextEditingController();
  final addressController = TextEditingController();
  final pinController = TextEditingController();

  @override
  void initState() {
    super.initState();
    nameController.addListener(_handleDraftInputChanged);
    mobileController.addListener(_handleDraftInputChanged);
    emailController.addListener(_handleDraftInputChanged);
    addressController.addListener(_handleDraftInputChanged);
    pinController.addListener(_handleDraftInputChanged);
  }

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (_draftHydrated) return;
    final appState = AppStateScope.of(context);
    final draft = appState.bookingFlowDraft;
    if (draft != null) {
      nameController.text = draft.name;
      mobileController.text =
          draft.mobile.isNotEmpty ? draft.mobile : (widget.initialMobile ?? '');
      emailController.text = draft.email;
      addressController.text = draft.address;
      pinController.text = draft.pinCode;
      selectedPlanCode =
          draft.selectedPlanCode.isEmpty ? null : draft.selectedPlanCode;
      _selectedDurationMonths = draft.selectedDurationMonths;
      _selectedDurationLabel = draft.selectedDurationLabel;
      _selectedSlotCode =
          draft.selectedSlotCode.isEmpty ? 'morning' : draft.selectedSlotCode;
      _selectedSlotLabel = draft.selectedSlotLabel.isEmpty
          ? '10 AM – 1 PM'
          : draft.selectedSlotLabel;
      _preferredDate = DateTime.tryParse(draft.preferredDateIso) ??
          DateTime.now().add(const Duration(days: 1));
      _selectedLocation = LatLng(draft.latitude, draft.longitude);
      _hasPickedLocation = draft.hasPickedLocation;
      _usedCurrentLocation = draft.usedCurrentLocation;
      step = draft.step.clamp(0, 3).toInt();
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (mounted) {
          _mapController.move(_selectedLocation, _hasPickedLocation ? 16 : 14);
        }
      });
    }
    _draftHydrated = true;
  }

  @override
  void dispose() {
    nameController.removeListener(_handleDraftInputChanged);
    mobileController.removeListener(_handleDraftInputChanged);
    emailController.removeListener(_handleDraftInputChanged);
    addressController.removeListener(_handleDraftInputChanged);
    pinController.removeListener(_handleDraftInputChanged);
    nameController.dispose();
    mobileController.dispose();
    emailController.dispose();
    addressController.dispose();
    pinController.dispose();
    super.dispose();
  }

  // ─── Build ─────────────────────────────────────────────────────────────────

  @override
  Widget build(BuildContext context) {
    final appState = AppStateScope.of(context);
    final session = appState.session;
    final plans = appState.plans;
    final latestBooking = appState.latestBooking;
    final selectedPlan = _selectedPlan(plans);

    if (nameController.text.isEmpty && session != null) {
      nameController.text = appState.dashboard.customerName;
    }
    if (mobileController.text.isEmpty) {
      mobileController.text = session?.mobile ?? widget.initialMobile ?? '';
    }

    return Scaffold(
      backgroundColor: kBg,
      body: Column(
        children: [
          // Gradient header
          _BookingHeader(
            step: step,
            selectedPlan: selectedPlan,
            mobileText: mobileController.text.trim(),
            durationLabel: _selectedDurationLabel,
          ),
          // Content
          Expanded(
            child: RefreshIndicator(
              color: kPrimary,
              backgroundColor: kSurface,
              onRefresh: appState.refresh,
              child: ListView(
                padding: const EdgeInsets.fromLTRB(18, 18, 18, 40),
                children: [
                  _stepper(),
                  const SizedBox(height: 20),
                  if (step == 0) _addressStep(appState),
                  if (step == 1) _planStep(appState, plans),
                  if (step == 2) _durationStep(plans),
                  if (step == 3) _bookingStep(appState, plans),
                  if (step == 4 && latestBooking != null)
                    _successStep(latestBooking),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }

  // ─── Steps ─────────────────────────────────────────────────────────────────

  Widget _addressStep(AppState appState) {
    final feasibility = appState.feasibility;
    if (_showUnavailableState && feasibility != null && !feasibility.feasible) {
      return _unavailableState(appState, feasibility.message);
    }
    return _sectionCard(
      title: 'Service address',
      subtitle: 'Confirm your location to unlock available plans',
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Draft restore banner
          if (appState.bookingFlowDraft != null) ...[
            Container(
              padding: const EdgeInsets.all(14),
              decoration: BoxDecoration(
                color: kPrimary.withValues(alpha: 0.08),
                borderRadius: BorderRadius.circular(14),
                border: Border.all(color: kPrimary.withValues(alpha: 0.25)),
              ),
              child: Row(
                children: [
                  const Icon(Icons.restore_rounded, color: kPrimary, size: 18),
                  const SizedBox(width: 10),
                  Expanded(
                    child: Text(
                      'Draft restored — continue where you left off.',
                      style: GoogleFonts.inter(
                          color: kPrimary,
                          fontSize: 13,
                          fontWeight: FontWeight.w600),
                    ),
                  ),
                  const SizedBox(width: 8),
                  GestureDetector(
                    onTap: () async =>
                        await _resetBookingFlow(clearSavedDraft: true),
                    child: Text(
                      'Clear',
                      style: GoogleFonts.inter(
                          color: kPrimary,
                          fontWeight: FontWeight.w800,
                          fontSize: 13),
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 16),
          ],

          // Checklist
          _addressChecklist(),
          const SizedBox(height: 18),

          // Fields
          _field('Full name', nameController,
              icon: Icons.person_outline_rounded),
          const SizedBox(height: 12),
          _field('Mobile number', mobileController,
              icon: Icons.phone_outlined, keyboardType: TextInputType.phone),
          const SizedBox(height: 12),
          _field('Email address', emailController,
              icon: Icons.mail_outline_rounded,
              keyboardType: TextInputType.emailAddress),
          const SizedBox(height: 12),
          _field('Installation address', addressController,
              icon: Icons.home_outlined, maxLines: 3),
          const SizedBox(height: 12),
          _field('Pin code', pinController,
              icon: Icons.pin_drop_outlined,
              keyboardType: TextInputType.number),

          const SizedBox(height: 18),

          // Location button
          SizedBox(
            width: double.infinity,
            child: FilledButton.icon(
              onPressed: _locationBusy ? null : _fetchCurrentLocation,
              icon: _locationBusy
                  ? const SizedBox(
                      width: 16,
                      height: 16,
                      child: CircularProgressIndicator(
                          color: Colors.white, strokeWidth: 2),
                    )
                  : const Icon(Icons.my_location_rounded, size: 18),
              label: Text(
                _locationBusy ? 'Fetching location…' : 'Use Current Location',
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
            height: 320,
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(22),
              border: Border.all(
                  color: _hasPickedLocation
                      ? kPrimary.withValues(alpha: 0.5)
                      : kPrimary.withValues(alpha: 0.2)),
              boxShadow: _hasPickedLocation
                  ? [
                      BoxShadow(
                          color: kPrimary.withValues(alpha: 0.18),
                          blurRadius: 20,
                          offset: const Offset(0, 6))
                    ]
                  : null,
            ),
            clipBehavior: Clip.antiAlias,
            child: Stack(
              children: [
                FlutterMap(
                  mapController: _mapController,
                  options: MapOptions(
                    initialCenter: _selectedLocation,
                    initialZoom: 16,
                    onTap: (_, point) {
                      setState(() {
                        _selectedLocation = point;
                        _hasPickedLocation = true;
                        _locationError = null;
                        _usedCurrentLocation = false;
                      });
                      _mapController.move(point, 16);
                      _persistBookingDraft();
                    },
                  ),
                  children: [
                    TileLayer(
                      urlTemplate:
                          'https://a.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}@2x.png',
                      userAgentPackageName: 'com.justfiber.customer',
                    ),
                    MarkerLayer(
                      markers: [
                        Marker(
                          point: _selectedLocation,
                          width: 48,
                          height: 48,
                          child: const Icon(Icons.location_pin,
                              size: 42, color: Color(0xFFEF4444)),
                        ),
                      ],
                    ),
                  ],
                ),
                // Hint overlay at top
                if (!_hasPickedLocation)
                  Positioned(
                    top: 12,
                    left: 12,
                    right: 12,
                    child: Container(
                      padding: const EdgeInsets.symmetric(
                          horizontal: 14, vertical: 10),
                      decoration: BoxDecoration(
                        color: const Color(0xF5050508),
                        borderRadius: BorderRadius.circular(12),
                        border:
                            Border.all(color: kPrimary.withValues(alpha: 0.3)),
                      ),
                      child: Row(
                        children: [
                          const Icon(Icons.touch_app_rounded,
                              color: kPrimary, size: 16),
                          const SizedBox(width: 8),
                          Expanded(
                            child: Text(
                              'Tap on the map to drop the exact install pin',
                              style: GoogleFonts.inter(
                                  color: Colors.white,
                                  fontSize: 12,
                                  fontWeight: FontWeight.w600),
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                // Pinned badge at bottom
                if (_hasPickedLocation)
                  Positioned(
                    bottom: 12,
                    left: 12,
                    right: 12,
                    child: Container(
                      padding: const EdgeInsets.symmetric(
                          horizontal: 14, vertical: 10),
                      decoration: BoxDecoration(
                        color: const Color(0xF5050508),
                        borderRadius: BorderRadius.circular(12),
                        border:
                            Border.all(color: kPrimary.withValues(alpha: 0.4)),
                      ),
                      child: Row(
                        children: [
                          Container(
                            width: 8,
                            height: 8,
                            decoration: const BoxDecoration(
                                color: Color(0xFF4ADE80),
                                shape: BoxShape.circle),
                          ),
                          const SizedBox(width: 8),
                          Expanded(
                            child: Text(
                              _usedCurrentLocation
                                  ? 'GPS pin active'
                                  : 'Manual pin active',
                              style: GoogleFonts.inter(
                                  color: const Color(0xFF4ADE80),
                                  fontSize: 12,
                                  fontWeight: FontWeight.w700),
                            ),
                          ),
                          GestureDetector(
                            onTap: () {
                              setState(() {
                                _hasPickedLocation = false;
                                _usedCurrentLocation = false;
                                _locationError = null;
                                _selectedLocation =
                                    const LatLng(28.6139, 77.2090);
                              });
                              _mapController.move(_selectedLocation, 14);
                              _persistBookingDraft();
                            },
                            child: Text(
                              'Reset',
                              style: GoogleFonts.inter(
                                  color: kMuted,
                                  fontSize: 12,
                                  fontWeight: FontWeight.w700),
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
              ],
            ),
          ),

          if ((_locationError ?? '').isNotEmpty) ...[
            const SizedBox(height: 10),
            Container(
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
                    child: Text(
                      _locationError!,
                      style: GoogleFonts.inter(
                          color: const Color(0xFFEF4444), fontSize: 13),
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 8),
            Wrap(
              spacing: 8,
              runSpacing: 8,
              children: [
                if (_locationServiceDisabled)
                  _ghostBtn(
                      'Location settings', Geolocator.openLocationSettings),
                if (_locationPermissionDeniedForever)
                  _ghostBtn('App settings', Geolocator.openAppSettings),
                _ghostBtn(
                    'Try again', _locationBusy ? null : _fetchCurrentLocation),
              ],
            ),
          ],

          // Feasibility result
          if (appState.feasibility != null) ...[
            const SizedBox(height: 14),
            Container(
              padding: const EdgeInsets.all(14),
              decoration: BoxDecoration(
                color: appState.feasibility!.feasible
                    ? const Color(0x124ADE80)
                    : const Color(0x12EF4444),
                borderRadius: BorderRadius.circular(14),
                border: Border.all(
                    color: appState.feasibility!.feasible
                        ? const Color(0x444ADE80)
                        : const Color(0x44EF4444)),
              ),
              child: Row(
                children: [
                  Icon(
                    appState.feasibility!.feasible
                        ? Icons.check_circle_outline_rounded
                        : Icons.cancel_outlined,
                    size: 18,
                    color: appState.feasibility!.feasible
                        ? const Color(0xFF4ADE80)
                        : const Color(0xFFEF4444),
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: Text(
                      appState.feasibility!.message,
                      style: GoogleFonts.inter(
                        color: appState.feasibility!.feasible
                            ? const Color(0xFF4ADE80)
                            : const Color(0xFFEF4444),
                        fontWeight: FontWeight.w700,
                        fontSize: 13,
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ],

          const SizedBox(height: 18),
          _primaryBtn(
            label: appState.bookingBusy ? 'Checking…' : 'Confirm & View Plans',
            onPressed: appState.bookingBusy
                ? null
                : () async {
                    if (!_validateAddressStep()) return;
                    final ok = await appState.checkFeasibility(
                      address: addressController.text.trim(),
                      pinCode: pinController.text.trim(),
                      lat: _selectedLocation.latitude,
                      lng: _selectedLocation.longitude,
                    );
                    if (!mounted) return;
                    if (ok) {
                      if (appState.plans.isEmpty) {
                        await appState.refreshPlans();
                        if (!mounted) return;
                      }
                      setState(() {
                        _showUnavailableState = false;
                        step = 1;
                      });
                      _persistBookingDraft();
                    } else {
                      final leadNumber = await appState.submitFeasibilityLead(
                        fullName: nameController.text.trim(),
                        mobile: mobileController.text.trim(),
                        address: addressController.text.trim(),
                        pinCode: pinController.text.trim(),
                        lat: _selectedLocation.latitude,
                        lng: _selectedLocation.longitude,
                      );
                      if (!mounted) return;
                      setState(() => _showUnavailableState = true);
                      ScaffoldMessenger.of(context).hideCurrentSnackBar();
                      if (leadNumber != null) {
                        ScaffoldMessenger.of(context).showSnackBar(
                          SnackBar(
                            content: Text(
                                'Lead $leadNumber created for manual follow-up.'),
                          ),
                        );
                      }
                    }
                  },
          ),
        ],
      ),
    );
  }

  Widget _unavailableState(AppState appState, String message) {
    return Container(
      padding: const EdgeInsets.all(28),
      decoration: BoxDecoration(
        color: kSurface,
        borderRadius: BorderRadius.circular(24),
        border: Border.all(color: const Color(0x44EF4444)),
      ),
      child: Column(
        children: [
          Container(
            width: 80,
            height: 80,
            decoration: BoxDecoration(
              color: const Color(0x18EF4444),
              shape: BoxShape.circle,
              border: Border.all(color: const Color(0x44EF4444)),
            ),
            child: const Icon(Icons.location_off_rounded,
                color: Color(0xFFEF4444), size: 38),
          ),
          const SizedBox(height: 20),
          Text(
            'We are not live here yet',
            textAlign: TextAlign.center,
            style: GoogleFonts.inter(
                fontSize: 22, fontWeight: FontWeight.w900, color: Colors.white),
          ),
          const SizedBox(height: 10),
          Text(
            message.isEmpty
                ? 'This address is outside our live serviceability map right now.'
                : message,
            textAlign: TextAlign.center,
            style: GoogleFonts.inter(color: kMuted, height: 1.5, fontSize: 14),
          ),
          const SizedBox(height: 10),
          Text(
            'Your inquiry has been captured for manual follow-up.',
            textAlign: TextAlign.center,
            style: GoogleFonts.inter(
                color: const Color(0xFFFBBF24),
                fontWeight: FontWeight.w700,
                fontSize: 13),
          ),
          const SizedBox(height: 24),
          _primaryBtn(
            label: 'Update address or pin',
            onPressed: () => setState(() => _showUnavailableState = false),
          ),
          const SizedBox(height: 10),
          SizedBox(
            width: double.infinity,
            child: OutlinedButton(
              onPressed: appState.bookingBusy
                  ? null
                  : () async {
                      final ok = await appState.checkFeasibility(
                        address: addressController.text.trim(),
                        pinCode: pinController.text.trim(),
                        lat: _selectedLocation.latitude,
                        lng: _selectedLocation.longitude,
                      );
                      if (!mounted) return;
                      if (ok) {
                        if (appState.plans.isEmpty) {
                          await appState.refreshPlans();
                          if (!mounted) return;
                        }
                        setState(() {
                          _showUnavailableState = false;
                          step = 1;
                        });
                        _persistBookingDraft();
                      }
                    },
              style: _outlinedStyle(),
              child: Text('Check again',
                  style: GoogleFonts.inter(fontWeight: FontWeight.w700)),
            ),
          ),
        ],
      ),
    );
  }

  Widget _planStep(AppState appState, List<dynamic> plans) {
    return _sectionCard(
      title: 'Choose a plan',
      subtitle: 'Pick the plan that fits your usage',
      child: Column(
        children: [
          if (plans.isEmpty) ...[
            Container(
              padding: const EdgeInsets.all(18),
              decoration: BoxDecoration(
                  color: kSurface2,
                  borderRadius: BorderRadius.circular(16),
                  border: Border.all(color: kPrimary.withValues(alpha: 0.2))),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text('Plans are loading…',
                      style: GoogleFonts.inter(
                          fontSize: 16,
                          fontWeight: FontWeight.w800,
                          color: Colors.white)),
                  const SizedBox(height: 8),
                  Text(
                    (appState.error ?? '').isNotEmpty
                        ? appState.error!
                        : 'Serviceability check passed. Retrying plan catalog…',
                    style: GoogleFonts.inter(
                        color: kMuted, height: 1.45, fontSize: 13),
                  ),
                  const SizedBox(height: 14),
                  _primaryBtn(
                      label: 'Reload plans',
                      onPressed: () async => await appState.refreshPlans()),
                ],
              ),
            ),
            const SizedBox(height: 14),
          ],
          ...plans.map((plan) => Padding(
                padding: const EdgeInsets.only(bottom: 14),
                child: _planTile(
                  planName: plan.name,
                  speed: '${plan.speedMbps.toStringAsFixed(0)} Mbps',
                  upload: '${plan.uploadSpeedMbps.toStringAsFixed(0)} Mbps',
                  data: plan.dataPolicy == 'unlimited'
                      ? 'Unlimited'
                      : '${plan.dataLimitGb.toStringAsFixed(0)} GB',
                  price: 'Rs ${plan.monthlyPrice.toStringAsFixed(0)} /mo',
                  selected: selectedPlanCode == plan.planCode,
                  onSelect: () {
                    setState(() => selectedPlanCode = plan.planCode);
                    _persistBookingDraft();
                  },
                ),
              )),
          const SizedBox(height: 4),
          _primaryBtn(
            label: 'Continue to Duration',
            onPressed: selectedPlanCode == null
                ? null
                : () {
                    final sel = plans.cast<dynamic>().firstWhere(
                          (item) => item?.planCode == selectedPlanCode,
                          orElse: () => null,
                        );
                    if (sel != null) {
                      final def = _availableDurations(sel).first;
                      _selectedDurationMonths = def.$1;
                      _selectedDurationLabel = def.$2;
                    }
                    setState(() => step = 2);
                    _persistBookingDraft();
                  },
          ),
          const SizedBox(height: 10),
          _backBtn('Back to Address', () {
            setState(() => step = 0);
            _persistBookingDraft();
          }),
        ],
      ),
    );
  }

  Widget _durationStep(List<dynamic> plans) {
    dynamic selected;
    for (final item in plans) {
      if (item.planCode == selectedPlanCode) {
        selected = item;
        break;
      }
    }
    final durations = selected == null
        ? const <(int, String)>[(1, '1 month')]
        : _availableDurations(selected);
    final recurringAmount = selected == null
        ? 0.0
        : _priceForDuration(selected, _selectedDurationMonths);
    final setupAmount = selected == null
        ? 0.0
        : ((selected.otcCharge ?? 0) as num).toDouble() +
            ((selected.installationCharge ?? 0) as num).toDouble();
    final totalAmount = recurringAmount + setupAmount;

    return _sectionCard(
      title: 'Choose duration',
      subtitle: selected == null
          ? 'Select a plan first'
          : 'Billing duration for ${selected.name}',
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          ...durations.map((option) => Padding(
                padding: const EdgeInsets.only(bottom: 12),
                child: _durationTile(
                  label: option.$2,
                  recurringAmount: _priceForDuration(selected, option.$1),
                  setupAmount: setupAmount,
                  selected: _selectedDurationMonths == option.$1,
                  onSelect: () {
                    setState(() {
                      _selectedDurationMonths = option.$1;
                      _selectedDurationLabel = option.$2;
                    });
                    _persistBookingDraft();
                  },
                ),
              )),
          const SizedBox(height: 8),
          _summaryBox([
            ('Duration', _selectedDurationLabel),
            ('Plan amount', 'Rs ${recurringAmount.toStringAsFixed(0)}'),
            ('Setup charges', 'Rs ${setupAmount.toStringAsFixed(0)}'),
            ('Payable now', 'Rs ${totalAmount.toStringAsFixed(0)}'),
          ]),
          const SizedBox(height: 16),
          _primaryBtn(
            label: 'Continue to Checkout',
            onPressed: selected == null
                ? null
                : () {
                    setState(() => step = 3);
                    _persistBookingDraft();
                  },
          ),
          const SizedBox(height: 10),
          _backBtn('Back to Plans', () {
            setState(() => step = 1);
            _persistBookingDraft();
          }),
        ],
      ),
    );
  }

  Widget _bookingStep(AppState appState, List<dynamic> plans) {
    final selected = _selectedPlan(plans);

    return _sectionCard(
      title: 'Review & Pay',
      subtitle: 'Confirm details before opening secure payment',
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          _summaryBox([
            (
              'Customer',
              nameController.text.trim().isEmpty
                  ? '—'
                  : nameController.text.trim()
            ),
            (
              'Mobile',
              mobileController.text.trim().isEmpty
                  ? '—'
                  : mobileController.text.trim()
            ),
            (
              'Email',
              emailController.text.trim().isEmpty
                  ? '—'
                  : emailController.text.trim()
            ),
            (
              'Address',
              addressController.text.trim().isEmpty
                  ? '—'
                  : addressController.text.trim()
            ),
            (
              'Pin code',
              pinController.text.trim().isEmpty
                  ? '—'
                  : pinController.text.trim()
            ),
            ('Plan', selected?.name ?? '—'),
            (
              'Speed',
              selected == null
                  ? '—'
                  : '${selected.speedMbps.toStringAsFixed(0)} Mbps'
            ),
            ('Duration', _selectedDurationLabel),
            (
              'Payable now',
              'Rs ${_bookingAmountFor(selected).toStringAsFixed(0)}'
            ),
          ]),

          const SizedBox(height: 16),

          // Payment info note
          Container(
            padding: const EdgeInsets.all(14),
            decoration: BoxDecoration(
              color: const Color(0x12FBBD24),
              borderRadius: BorderRadius.circular(14),
              border: Border.all(color: const Color(0x44FBBF24)),
            ),
            child: Row(
              children: [
                const Icon(Icons.info_outline_rounded,
                    color: Color(0xFFFBBF24), size: 16),
                const SizedBox(width: 10),
                Expanded(
                  child: Text(
                    'Payment completes the booking first. Install date and slot are confirmed in the next step.',
                    style: GoogleFonts.inter(
                        color: const Color(0xFFFBBF24),
                        fontSize: 12,
                        height: 1.45,
                        fontWeight: FontWeight.w600),
                  ),
                ),
              ],
            ),
          ),

          const SizedBox(height: 14),

          // Secure payment indicator
          Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              gradient: LinearGradient(
                colors: [
                  kPrimary.withValues(alpha: 0.12),
                  const Color(0xFF7C3AED).withValues(alpha: 0.08),
                ],
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
              ),
              borderRadius: BorderRadius.circular(16),
              border: Border.all(color: kPrimary.withValues(alpha: 0.25)),
            ),
            child: Row(
              children: [
                Container(
                  width: 40,
                  height: 40,
                  decoration: BoxDecoration(
                      color: kPrimary.withValues(alpha: 0.15),
                      borderRadius: BorderRadius.circular(12)),
                  child:
                      const Icon(Icons.lock_rounded, color: kPrimary, size: 20),
                ),
                const SizedBox(width: 12),
                Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'Secure Payment',
                      style: GoogleFonts.inter(
                          color: Colors.white,
                          fontWeight: FontWeight.w800,
                          fontSize: 14),
                    ),
                    Text(
                      'Razorpay checkout will open next',
                      style: GoogleFonts.inter(color: kMuted, fontSize: 12),
                    ),
                  ],
                ),
              ],
            ),
          ),

          if (appState.session == null) ...[
            const SizedBox(height: 10),
            Container(
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: const Color(0x12EF4444),
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: const Color(0x44EF4444)),
              ),
              child: Text(
                'Login is required before opening secure payment checkout.',
                style: GoogleFonts.inter(
                    color: const Color(0xFFEF4444), fontSize: 13),
              ),
            ),
          ],

          const SizedBox(height: 18),
          _primaryBtn(
            label: appState.bookingBusy ? 'Preparing checkout…' : 'Pay now',
            onPressed: appState.bookingBusy || appState.session == null
                ? null
                : () async {
                    final ok = await appState.createBooking(
                      planCode: selectedPlanCode!,
                      fullName: nameController.text.trim(),
                      mobile: mobileController.text.trim(),
                      email: emailController.text.trim(),
                      address: addressController.text.trim(),
                      pinCode: pinController.text.trim(),
                      lat: _selectedLocation.latitude,
                      lng: _selectedLocation.longitude,
                      durationMonths: _selectedDurationMonths,
                      durationLabel: _selectedDurationLabel,
                      paymentMode: _selectedPaymentMode,
                    );
                    if (!mounted) return;
                    if (ok) {
                      final order = await appState.loadBookingPaymentOrder(
                        bookingNumber: appState.latestBooking!.bookingNumber,
                        amount: appState.latestBooking!.amount,
                      );
                      if (!mounted) return;
                      if (order != null) {
                        final paid = await Navigator.of(context).push<bool>(
                          MaterialPageRoute(
                            builder: (_) => BookingPaymentScreen(
                              bookingNumber:
                                  appState.latestBooking!.bookingNumber,
                              paymentOrder: order,
                            ),
                          ),
                        );
                        if (!mounted) return;
                        if (paid == true) {
                          await appState.refresh();
                          await appState.clearBookingFlowDraft();
                          if (!mounted) return;
                          setState(() => step = 4);
                        }
                      } else {
                        ScaffoldMessenger.of(context).showSnackBar(
                          SnackBar(
                              content: Text(appState.error ??
                                  'Unable to start booking payment')),
                        );
                      }
                    } else {
                      ScaffoldMessenger.of(context).showSnackBar(
                        SnackBar(
                            content: Text(appState.bookingError ??
                                'Unable to create booking')),
                      );
                    }
                  },
          ),
          const SizedBox(height: 10),
          _backBtn('Back to Duration', () {
            setState(() => step = 2);
            _persistBookingDraft();
          }),
        ],
      ),
    );
  }

  Widget _successStep(dynamic latestBooking) {
    final appState = AppStateScope.of(context);
    final navigator = Navigator.of(context);
    final messenger = ScaffoldMessenger.of(context);

    return _sectionCard(
      title: 'Confirm install slot',
      subtitle: 'Pick your preferred date and time',
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Success hero
          Container(
            padding: const EdgeInsets.all(20),
            decoration: BoxDecoration(
              gradient: const LinearGradient(
                colors: [
                  Color(0xFF13051F),
                  Color(0xFF3B0D7A),
                  Color(0xFFA855F7)
                ],
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
              ),
              borderRadius: BorderRadius.circular(20),
              border: Border.all(color: const Color(0x55D8B4FE)),
            ),
            child: Row(
              children: [
                Container(
                  width: 54,
                  height: 54,
                  decoration: BoxDecoration(
                    color: Colors.white.withValues(alpha: 0.18),
                    shape: BoxShape.circle,
                    border:
                        Border.all(color: Colors.white.withValues(alpha: 0.3)),
                  ),
                  child: const Icon(Icons.check_rounded,
                      color: Colors.white, size: 28),
                ),
                const SizedBox(width: 14),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'Payment received!',
                        style: GoogleFonts.inter(
                            color: Colors.white,
                            fontWeight: FontWeight.w900,
                            fontSize: 18),
                      ),
                      const SizedBox(height: 4),
                      Text(
                        'Booking ${latestBooking.bookingNumber} · ${latestBooking.status}',
                        style: GoogleFonts.inter(
                            color: Colors.white70, fontSize: 13),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),

          const SizedBox(height: 16),

          // Booking chips
          Row(
            children: [
              _successChip('Booking ID', latestBooking.bookingNumber),
              const SizedBox(width: 10),
              _successChip('Status', latestBooking.status.replaceAll('_', ' ')),
            ],
          ),

          const SizedBox(height: 14),

          _summaryBox([
            ('Plan', latestBooking.planName),
            ('Amount', 'Rs ${latestBooking.amount.toStringAsFixed(0)}'),
            ('Duration', latestBooking.durationLabel),
            ('Current step', latestBooking.currentStep),
            (
              'Install address',
              addressController.text.trim().isEmpty
                  ? '—'
                  : addressController.text.trim()
            ),
            (
              'Pin code',
              pinController.text.trim().isEmpty
                  ? '—'
                  : pinController.text.trim()
            ),
          ]),

          const SizedBox(height: 20),

          // Date picker
          Text(
            'Choose install date',
            style: GoogleFonts.inter(
                color: Colors.white, fontWeight: FontWeight.w800, fontSize: 15),
          ),
          const SizedBox(height: 12),
          SizedBox(
            height: 52,
            child: ListView.separated(
              scrollDirection: Axis.horizontal,
              itemCount: 5,
              separatorBuilder: (_, __) => const SizedBox(width: 8),
              itemBuilder: (_, index) {
                final date = DateTime.now().add(Duration(days: index + 1));
                final sel = _isSameDate(date, _preferredDate);
                return GestureDetector(
                  onTap: () {
                    setState(() => _preferredDate = date);
                    _persistBookingDraft();
                  },
                  child: AnimatedContainer(
                    duration: const Duration(milliseconds: 200),
                    padding: const EdgeInsets.symmetric(
                        horizontal: 16, vertical: 10),
                    decoration: BoxDecoration(
                      gradient: sel
                          ? const LinearGradient(
                              colors: [Color(0xFFBB6FF7), Color(0xFF7C3AED)],
                              begin: Alignment.topLeft,
                              end: Alignment.bottomRight,
                            )
                          : null,
                      color: sel ? null : kSurface2,
                      borderRadius: BorderRadius.circular(14),
                      border: Border.all(
                        color: sel
                            ? Colors.transparent
                            : kPrimary.withValues(alpha: 0.2),
                      ),
                    ),
                    child: Text(
                      _formatDate(date),
                      style: GoogleFonts.inter(
                        color: Colors.white,
                        fontWeight: FontWeight.w700,
                        fontSize: 13,
                      ),
                    ),
                  ),
                );
              },
            ),
          ),

          const SizedBox(height: 18),

          // Slot picker
          Text(
            'Choose install slot',
            style: GoogleFonts.inter(
                color: Colors.white, fontWeight: FontWeight.w800, fontSize: 15),
          ),
          const SizedBox(height: 12),
          Column(
            children: _slotOptions.map((slot) {
              final sel = _selectedSlotCode == slot.$1;
              return Padding(
                padding: const EdgeInsets.only(bottom: 10),
                child: GestureDetector(
                  onTap: () {
                    setState(() {
                      _selectedSlotCode = slot.$1;
                      _selectedSlotLabel = slot.$2;
                    });
                    _persistBookingDraft();
                  },
                  child: AnimatedContainer(
                    duration: const Duration(milliseconds: 200),
                    padding: const EdgeInsets.symmetric(
                        horizontal: 18, vertical: 14),
                    decoration: BoxDecoration(
                      gradient: sel
                          ? const LinearGradient(
                              colors: [Color(0xFF1D0545), Color(0xFF3B0D7A)],
                              begin: Alignment.topLeft,
                              end: Alignment.bottomRight,
                            )
                          : null,
                      color: sel ? null : kSurface2,
                      borderRadius: BorderRadius.circular(16),
                      border: Border.all(
                        color: sel
                            ? kPrimary.withValues(alpha: 0.5)
                            : kPrimary.withValues(alpha: 0.12),
                        width: sel ? 1.5 : 1,
                      ),
                    ),
                    child: Row(
                      children: [
                        Container(
                          width: 22,
                          height: 22,
                          decoration: BoxDecoration(
                            shape: BoxShape.circle,
                            color: sel ? kPrimary : Colors.transparent,
                            border: Border.all(
                              color: sel
                                  ? kPrimary
                                  : kMuted.withValues(alpha: 0.4),
                              width: 2,
                            ),
                          ),
                          child: sel
                              ? const Icon(Icons.check_rounded,
                                  size: 12, color: Colors.white)
                              : null,
                        ),
                        const SizedBox(width: 14),
                        Expanded(
                          child: Text(
                            slot.$2,
                            style: GoogleFonts.inter(
                              color: Colors.white,
                              fontWeight:
                                  sel ? FontWeight.w700 : FontWeight.w500,
                              fontSize: 14,
                            ),
                          ),
                        ),
                        if (sel)
                          Text(
                            'Selected',
                            style: GoogleFonts.inter(
                                color: kPrimary,
                                fontSize: 11,
                                fontWeight: FontWeight.w700),
                          ),
                      ],
                    ),
                  ),
                ),
              );
            }).toList(),
          ),

          const SizedBox(height: 14),

          _summaryBox([
            ('Preferred date', _formatDate(_preferredDate)),
            ('Preferred slot', _selectedSlotLabel ?? '—'),
          ]),

          const SizedBox(height: 14),

          // What happens next
          Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: kSurface2,
              borderRadius: BorderRadius.circular(16),
              border: Border.all(color: kPrimary.withValues(alpha: 0.12)),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'What happens next?',
                  style: GoogleFonts.inter(
                      color: Colors.white,
                      fontWeight: FontWeight.w800,
                      fontSize: 14),
                ),
                const SizedBox(height: 10),
                _nextStep('1',
                    'Operations and installer teams can see this booking now.'),
                _nextStep('2',
                    'Your map pin and preferred slot are attached to the job.'),
                _nextStep('3',
                    'Track live updates from the service tracking screen.'),
              ],
            ),
          ),

          const SizedBox(height: 18),

          _primaryBtn(
            label: 'Save slot and confirm',
            onPressed: appState.busy
                ? null
                : () async {
                    final ok = await appState.saveBookingPreferences(
                      bookingNumber: latestBooking.bookingNumber,
                      preferredDate: _preferredDate.toIso8601String(),
                      preferredSlotCode: _selectedSlotCode,
                      preferredSlotLabel: _selectedSlotLabel,
                    );
                    if (!mounted) return;
                    if (ok) {
                      await appState.clearBookingFlowDraft();
                      if (!mounted) return;
                    }
                    messenger.showSnackBar(
                      SnackBar(
                        content: Text(ok
                            ? 'Booking confirmed and slot saved.'
                            : (appState.error ??
                                'Unable to save slot preference')),
                      ),
                    );
                  },
          ),

          const SizedBox(height: 10),

          Row(
            children: [
              Expanded(
                child: OutlinedButton(
                  onPressed: () async {
                    await navigator.push(
                      MaterialPageRoute(
                          builder: (_) => const ServiceTrackingScreen()),
                    );
                    if (mounted) {
                      await appState.refreshBookingTracking();
                    }
                  },
                  style: _outlinedStyle(),
                  child: Text('Track booking',
                      style: GoogleFonts.inter(fontWeight: FontWeight.w700)),
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: FilledButton(
                  onPressed: () async {
                    await appState.refreshBookingTracking();
                    if (!mounted) return;
                    navigator.pop();
                  },
                  style: FilledButton.styleFrom(
                    backgroundColor: kPrimary,
                    foregroundColor: Colors.white,
                    padding: const EdgeInsets.symmetric(vertical: 14),
                    shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(14)),
                  ),
                  child: Text('Done',
                      style: GoogleFonts.inter(fontWeight: FontWeight.w700)),
                ),
              ),
            ],
          ),

          const SizedBox(height: 10),

          _backBtn('Create another booking', () async {
            await _resetBookingFlow(clearSavedDraft: true);
          }),
          const SizedBox(height: 8),
          _backBtn('Return to App Home', () async {
            await appState.refresh();
            if (!mounted) return;
            navigator.pop();
          }),
        ],
      ),
    );
  }

  // ─── Stepper ───────────────────────────────────────────────────────────────

  Widget _stepper() {
    const labels = ['Address', 'Plan', 'Duration', 'Checkout', 'Confirm'];
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: kSurface,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: kBorder),
      ),
      child: Column(
        children: [
          Row(
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
                            duration: const Duration(milliseconds: 300),
                            width: 32,
                            height: 32,
                            decoration: BoxDecoration(
                              gradient: active
                                  ? const LinearGradient(
                                      colors: [
                                        Color(0xFFBB6FF7),
                                        Color(0xFF7C3AED)
                                      ],
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
                                      size: 15, color: Colors.white)
                                  : Text(
                                      '${i + 1}',
                                      style: GoogleFonts.inter(
                                        color: active ? Colors.white : kMuted,
                                        fontSize: 12,
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
                                ? const LinearGradient(
                                    colors: [
                                      Color(0xFFBB6FF7),
                                      Color(0xFF7C3AED)
                                    ],
                                  )
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
        ],
      ),
    );
  }

  // ─── UI helpers ────────────────────────────────────────────────────────────

  Widget _sectionCard({
    required String title,
    required String subtitle,
    required Widget child,
  }) {
    return Container(
      padding: const EdgeInsets.all(22),
      decoration: BoxDecoration(
        color: kSurface,
        borderRadius: BorderRadius.circular(24),
        border: Border.all(color: kPrimary.withValues(alpha: 0.15)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            title,
            style: GoogleFonts.inter(
                color: Colors.white,
                fontSize: 22,
                fontWeight: FontWeight.w900,
                letterSpacing: -0.5),
          ),
          const SizedBox(height: 4),
          Text(
            subtitle,
            style: GoogleFonts.inter(color: kMuted, fontSize: 13),
          ),
          const SizedBox(height: 20),
          child,
        ],
      ),
    );
  }

  Widget _field(
    String label,
    TextEditingController controller, {
    int maxLines = 1,
    TextInputType keyboardType = TextInputType.text,
    IconData? icon,
  }) {
    return TextField(
      controller: controller,
      maxLines: maxLines,
      keyboardType: keyboardType,
      style: GoogleFonts.inter(color: Colors.white, fontSize: 14),
      decoration: InputDecoration(
        labelText: label,
        labelStyle: GoogleFonts.inter(color: kMuted, fontSize: 13),
        prefixIcon: icon != null ? Icon(icon, size: 18, color: kMuted) : null,
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
    );
  }

  Widget _planTile({
    required String planName,
    required String speed,
    required String upload,
    required String data,
    required String price,
    required bool selected,
    required VoidCallback onSelect,
  }) {
    return GestureDetector(
      onTap: onSelect,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 200),
        padding: const EdgeInsets.all(18),
        decoration: BoxDecoration(
          gradient: selected
              ? const LinearGradient(
                  colors: [
                    Color(0xFF13051F),
                    Color(0xFF3B0D7A),
                    Color(0xFFA855F7)
                  ],
                  begin: Alignment.topLeft,
                  end: Alignment.bottomRight,
                )
              : null,
          color: selected ? null : kSurface2,
          borderRadius: BorderRadius.circular(20),
          border: Border.all(
            color: selected
                ? const Color(0x88D8B4FE)
                : kPrimary.withValues(alpha: 0.12),
            width: selected ? 1.5 : 1,
          ),
          boxShadow: selected
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
                    planName,
                    style: GoogleFonts.inter(
                      color: Colors.white,
                      fontWeight: FontWeight.w900,
                      fontSize: 17,
                      letterSpacing: -0.3,
                    ),
                  ),
                ),
                Container(
                  padding:
                      const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                  decoration: BoxDecoration(
                    color: selected
                        ? Colors.white.withValues(alpha: 0.18)
                        : kPrimary.withValues(alpha: 0.1),
                    borderRadius: BorderRadius.circular(999),
                    border: Border.all(
                      color: selected
                          ? Colors.white.withValues(alpha: 0.3)
                          : kPrimary.withValues(alpha: 0.3),
                    ),
                  ),
                  child: Text(
                    selected ? 'Selected ✓' : 'Select',
                    style: GoogleFonts.inter(
                      color: selected ? Colors.white : kPrimary,
                      fontSize: 11,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 14),
            Text(
              price,
              style: GoogleFonts.inter(
                color: selected ? Colors.white : Colors.white,
                fontWeight: FontWeight.w900,
                fontSize: 22,
                letterSpacing: -0.5,
              ),
            ),
            const SizedBox(height: 12),
            Row(
              children: [
                _planStat(speed, 'Speed'),
                _planDivider(),
                _planStat(upload, 'Upload'),
                _planDivider(),
                _planStat(data, 'Data'),
              ],
            ),
          ],
        ),
      ),
    );
  }

  Widget _planStat(String value, String label) => Expanded(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(value,
                style: GoogleFonts.inter(
                    color: Colors.white,
                    fontWeight: FontWeight.w800,
                    fontSize: 13)),
            const SizedBox(height: 2),
            Text(label,
                style: GoogleFonts.inter(color: Colors.white60, fontSize: 11)),
          ],
        ),
      );

  Widget _planDivider() => Container(
      width: 1,
      height: 28,
      margin: const EdgeInsets.symmetric(horizontal: 10),
      color: Colors.white.withValues(alpha: 0.15));

  Widget _durationTile({
    required String label,
    required double recurringAmount,
    required double setupAmount,
    required bool selected,
    required VoidCallback onSelect,
  }) {
    final payable = recurringAmount + setupAmount;
    return GestureDetector(
      onTap: onSelect,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 200),
        padding: const EdgeInsets.all(18),
        decoration: BoxDecoration(
          gradient: selected
              ? const LinearGradient(
                  colors: [
                    Color(0xFF13051F),
                    Color(0xFF3B0D7A),
                    Color(0xFFA855F7)
                  ],
                  begin: Alignment.topLeft,
                  end: Alignment.bottomRight,
                )
              : null,
          color: selected ? null : kSurface2,
          borderRadius: BorderRadius.circular(20),
          border: Border.all(
            color: selected
                ? const Color(0x88D8B4FE)
                : kPrimary.withValues(alpha: 0.12),
            width: selected ? 1.5 : 1,
          ),
          boxShadow: selected
              ? [
                  BoxShadow(
                      color: kPrimary.withValues(alpha: 0.28),
                      blurRadius: 18,
                      offset: const Offset(0, 6))
                ]
              : null,
        ),
        child: Row(
          children: [
            Container(
              width: 24,
              height: 24,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                color: selected ? kPrimary : Colors.transparent,
                border: Border.all(
                  color: selected ? kPrimary : kMuted.withValues(alpha: 0.4),
                  width: 2,
                ),
              ),
              child: selected
                  ? const Icon(Icons.check_rounded,
                      size: 13, color: Colors.white)
                  : null,
            ),
            const SizedBox(width: 14),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    label,
                    style: GoogleFonts.inter(
                        color: Colors.white,
                        fontWeight: FontWeight.w800,
                        fontSize: 16),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    'Rs ${recurringAmount.toStringAsFixed(0)} plan + Rs ${setupAmount.toStringAsFixed(0)} setup',
                    style:
                        GoogleFonts.inter(color: Colors.white60, fontSize: 12),
                  ),
                ],
              ),
            ),
            Column(
              crossAxisAlignment: CrossAxisAlignment.end,
              children: [
                Text(
                  'Rs ${payable.toStringAsFixed(0)}',
                  style: GoogleFonts.inter(
                      color: Colors.white,
                      fontWeight: FontWeight.w900,
                      fontSize: 16),
                ),
                Text(
                  'payable',
                  style: GoogleFonts.inter(color: Colors.white60, fontSize: 10),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }

  Widget _summaryBox(List<(String, String)> rows) {
    return Container(
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
                    const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                child: Row(
                  children: [
                    Text(
                      e.value.$1,
                      style: GoogleFonts.inter(
                          color: kMuted,
                          fontSize: 13,
                          fontWeight: FontWeight.w500),
                    ),
                    const Spacer(),
                    Flexible(
                      child: Text(
                        e.value.$2,
                        textAlign: TextAlign.right,
                        style: GoogleFonts.inter(
                            color: Colors.white,
                            fontSize: 13,
                            fontWeight: FontWeight.w700),
                      ),
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
  }

  Widget _addressChecklist() {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: kSurface2,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: kPrimary.withValues(alpha: 0.12)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'Complete before checking plans',
            style: GoogleFonts.inter(
                color: Colors.white, fontWeight: FontWeight.w800, fontSize: 13),
          ),
          const SizedBox(height: 10),
          _checkItem('Full name', nameController.text.trim().isNotEmpty),
          _checkItem(
              'Mobile number', mobileController.text.trim().length >= 10),
          _checkItem('Address', addressController.text.trim().length >= 5),
          _checkItem('Pin code', pinController.text.trim().length >= 4),
          _checkItem('Map pin dropped', _hasPickedLocation),
        ],
      ),
    );
  }

  Widget _checkItem(String label, bool done) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: Row(
        children: [
          Icon(
            done
                ? Icons.check_circle_rounded
                : Icons.radio_button_unchecked_rounded,
            size: 17,
            color: done ? const Color(0xFF4ADE80) : kMuted,
          ),
          const SizedBox(width: 8),
          Text(
            label,
            style: GoogleFonts.inter(
              color: done ? Colors.white : kMuted,
              fontWeight: FontWeight.w600,
              fontSize: 13,
            ),
          ),
        ],
      ),
    );
  }

  Widget _successChip(String label, String value) {
    return Expanded(
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
        decoration: BoxDecoration(
          color: kSurface2,
          borderRadius: BorderRadius.circular(14),
          border: Border.all(color: kPrimary.withValues(alpha: 0.2)),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(label,
                style: GoogleFonts.inter(
                    color: kMuted, fontSize: 10, fontWeight: FontWeight.w600)),
            const SizedBox(height: 4),
            Text(value,
                style: GoogleFonts.inter(
                    color: Colors.white,
                    fontWeight: FontWeight.w800,
                    fontSize: 13)),
          ],
        ),
      ),
    );
  }

  Widget _nextStep(String number, String text) {
    return Padding(
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
              child: Text(
                number,
                style: GoogleFonts.inter(
                    color: kPrimary, fontSize: 10, fontWeight: FontWeight.w800),
              ),
            ),
          ),
          const SizedBox(width: 10),
          Expanded(
            child: Text(
              text,
              style:
                  GoogleFonts.inter(color: kMuted, fontSize: 13, height: 1.4),
            ),
          ),
        ],
      ),
    );
  }

  Widget _primaryBtn(
      {required String label, required VoidCallback? onPressed}) {
    return SizedBox(
      width: double.infinity,
      child: FilledButton(
        onPressed: onPressed,
        style: FilledButton.styleFrom(
          backgroundColor: kPrimary,
          foregroundColor: Colors.white,
          disabledBackgroundColor: kPrimary.withValues(alpha: 0.3),
          padding: const EdgeInsets.symmetric(vertical: 16),
          shape:
              RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        ),
        child: Text(label,
            style:
                GoogleFonts.inter(fontWeight: FontWeight.w700, fontSize: 15)),
      ),
    );
  }

  Widget _backBtn(String label, VoidCallback onPressed) {
    return SizedBox(
      width: double.infinity,
      child: OutlinedButton(
        onPressed: onPressed,
        style: _outlinedStyle(),
        child: Text(label,
            style:
                GoogleFonts.inter(fontWeight: FontWeight.w600, fontSize: 14)),
      ),
    );
  }

  Widget _ghostBtn(String label, VoidCallback? onPressed) {
    return OutlinedButton(
      onPressed: onPressed,
      style: _outlinedStyle(),
      child: Text(label, style: GoogleFonts.inter(fontWeight: FontWeight.w600)),
    );
  }

  ButtonStyle _outlinedStyle() => OutlinedButton.styleFrom(
        foregroundColor: Colors.white,
        side: BorderSide(color: kPrimary.withValues(alpha: 0.3)),
        padding: const EdgeInsets.symmetric(vertical: 14),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
      );

  // ─── Logic helpers (unchanged) ─────────────────────────────────────────────

  bool _validateAddressStep() {
    final messenger = ScaffoldMessenger.of(context);
    if (nameController.text.trim().length < 2) {
      messenger.showSnackBar(const SnackBar(
          content: Text('Enter customer name before continuing.')));
      return false;
    }
    final mobile = mobileController.text.trim();
    if (mobile.length != 10 || int.tryParse(mobile) == null) {
      messenger.showSnackBar(const SnackBar(
          content:
              Text('Enter a valid 10-digit mobile number before continuing.')));
      return false;
    }
    if (addressController.text.trim().length < 5) {
      messenger.showSnackBar(const SnackBar(
          content: Text('Enter installation address before continuing.')));
      return false;
    }
    if (pinController.text.trim().length < 4) {
      messenger.showSnackBar(const SnackBar(
          content: Text('Enter a valid pin code before continuing.')));
      return false;
    }
    if (!_hasPickedLocation) {
      messenger.showSnackBar(const SnackBar(
          content: Text('Drop the exact installation pin on the map.')));
      return false;
    }
    return true;
  }

  bool _isSameDate(DateTime left, DateTime right) =>
      left.year == right.year &&
      left.month == right.month &&
      left.day == right.day;

  String _formatDate(DateTime date) {
    const months = [
      'Jan',
      'Feb',
      'Mar',
      'Apr',
      'May',
      'Jun',
      'Jul',
      'Aug',
      'Sep',
      'Oct',
      'Nov',
      'Dec'
    ];
    return '${date.day} ${months[date.month - 1]}';
  }

  Future<void> _fetchCurrentLocation() async {
    setState(() {
      _locationBusy = true;
      _locationError = null;
      _locationPermissionDeniedForever = false;
      _locationServiceDisabled = false;
    });
    try {
      final serviceEnabled = await Geolocator.isLocationServiceEnabled();
      if (!serviceEnabled) {
        setState(() => _locationServiceDisabled = true);
        throw Exception('Location services are turned off.');
      }
      var permission = await Geolocator.checkPermission();
      if (permission == LocationPermission.denied) {
        permission = await Geolocator.requestPermission();
      }
      if (permission == LocationPermission.deniedForever) {
        setState(() => _locationPermissionDeniedForever = true);
        throw Exception(
            'Location permission is permanently denied. Open app settings and allow location access.');
      }
      if (permission == LocationPermission.denied) {
        throw Exception(
            'Location permission is required to fetch current location.');
      }
      final position = await Geolocator.getCurrentPosition(
          locationSettings:
              const LocationSettings(accuracy: LocationAccuracy.high));
      setState(() {
        _selectedLocation = LatLng(position.latitude, position.longitude);
        _hasPickedLocation = true;
        _usedCurrentLocation = true;
      });
      _mapController.move(_selectedLocation, 17);
      _persistBookingDraft();
      _showLocationFeedback('Current location pinned on the map.');
    } catch (e) {
      setState(() {
        _locationError = e.toString().replaceFirst('Exception: ', '');
      });
    } finally {
      if (mounted) setState(() => _locationBusy = false);
    }
  }

  void _handleDraftInputChanged() => _persistBookingDraft();

  bool _hasDraftContent() =>
      step > 0 ||
      (selectedPlanCode ?? '').isNotEmpty ||
      nameController.text.trim().isNotEmpty ||
      mobileController.text.trim().isNotEmpty ||
      emailController.text.trim().isNotEmpty ||
      addressController.text.trim().isNotEmpty ||
      pinController.text.trim().isNotEmpty ||
      _hasPickedLocation;

  Future<void> _persistBookingDraft() async {
    if (!mounted || !_draftHydrated) return;
    final appState = AppStateScope.of(context);
    if (step >= 4 || !_hasDraftContent()) {
      await appState.clearBookingFlowDraft();
      return;
    }
    await appState.saveBookingFlowDraft(
      step: step,
      selectedPlanCode: selectedPlanCode ?? '',
      selectedDurationMonths: _selectedDurationMonths,
      selectedDurationLabel: _selectedDurationLabel,
      selectedSlotCode: _selectedSlotCode ?? 'morning',
      selectedSlotLabel: _selectedSlotLabel ?? '10 AM – 1 PM',
      preferredDateIso: _preferredDate.toIso8601String(),
      name: nameController.text.trim(),
      mobile: mobileController.text.trim(),
      email: emailController.text.trim(),
      address: addressController.text.trim(),
      pinCode: pinController.text.trim(),
      latitude: _selectedLocation.latitude,
      longitude: _selectedLocation.longitude,
      hasPickedLocation: _hasPickedLocation,
      usedCurrentLocation: _usedCurrentLocation,
    );
  }

  Future<void> _resetBookingFlow({required bool clearSavedDraft}) async {
    final appState = AppStateScope.of(context);
    setState(() {
      step = 0;
      selectedPlanCode = null;
      _selectedDurationMonths = 1;
      _selectedDurationLabel = '1 month';
      _selectedSlotCode = 'morning';
      _selectedSlotLabel = '10 AM – 1 PM';
      _preferredDate = DateTime.now().add(const Duration(days: 1));
      _selectedLocation = const LatLng(28.6139, 77.2090);
      _hasPickedLocation = false;
      _usedCurrentLocation = false;
      _locationError = null;
      _showUnavailableState = false;
      nameController.clear();
      mobileController.text = AppStateScope.of(context).session?.mobile ??
          widget.initialMobile ??
          '';
      emailController.clear();
      addressController.clear();
      pinController.clear();
    });
    appState.clearBookingDraft();
    _mapController.move(_selectedLocation, 14);
    if (clearSavedDraft) {
      await appState.clearBookingFlowDraft();
    }
  }

  void _showLocationFeedback(String message) {
    if (!mounted) return;
    ScaffoldMessenger.of(context)
        .showSnackBar(SnackBar(content: Text(message)));
  }

  dynamic _selectedPlan(List<dynamic> plans) {
    for (final item in plans) {
      if (item.planCode == selectedPlanCode) return item;
    }
    return null;
  }

  List<(int, String)> _availableDurations(dynamic plan) {
    final durations = <(int, String)>[];
    final mp = ((plan.monthlyPrice ?? 0) as num).toDouble();
    final qp = ((plan.quarterlyPrice ?? 0) as num).toDouble();
    final hp = ((plan.halfYearlyPrice ?? 0) as num).toDouble();
    final yp = ((plan.yearlyPrice ?? 0) as num).toDouble();
    if (plan.validityMonthly == true || mp > 0) {
      durations.add((1, '1 month'));
    }
    if (plan.validityQuarterly == true || qp > 0) {
      durations.add((3, '3 months'));
    }
    if (plan.validityHalfYearly == true || hp > 0) {
      durations.add((6, '6 months'));
    }
    if (plan.validityYearly == true || yp > 0) {
      durations.add((12, '12 months'));
    }
    if (durations.isEmpty) durations.add((1, '1 month'));
    return durations;
  }

  double _priceForDuration(dynamic plan, int months) {
    if (plan == null) return 0;
    final mp = ((plan.monthlyPrice ?? 0) as num).toDouble();
    final qp = ((plan.quarterlyPrice ?? 0) as num).toDouble();
    final hp = ((plan.halfYearlyPrice ?? 0) as num).toDouble();
    final yp = ((plan.yearlyPrice ?? 0) as num).toDouble();
    switch (months) {
      case 12:
        return yp > 0 ? yp : mp * 12;
      case 6:
        return hp > 0 ? hp : mp * 6;
      case 3:
        return qp > 0 ? qp : mp * 3;
      default:
        return mp;
    }
  }

  double _bookingAmountFor(dynamic plan) {
    if (plan == null) return 0;
    final recurring = _priceForDuration(plan, _selectedDurationMonths);
    final setup = ((plan.otcCharge ?? 0) as num).toDouble() +
        ((plan.installationCharge ?? 0) as num).toDouble();
    return recurring + setup;
  }
}

// ─── Booking Header ────────────────────────────────────────────────────────────

class _BookingHeader extends StatelessWidget {
  const _BookingHeader({
    required this.step,
    required this.selectedPlan,
    required this.mobileText,
    required this.durationLabel,
  });

  final int step;
  final dynamic selectedPlan;
  final String mobileText;
  final String durationLabel;

  static const _stepNames = [
    'Address',
    'Plan',
    'Duration',
    'Checkout',
    'Confirm',
  ];

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: const BoxDecoration(
        gradient: LinearGradient(
          colors: [Color(0xFF13051F), Color(0xFF3B0D7A), Color(0xFFA855F7)],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
      ),
      child: Stack(
        children: [
          Positioned(
            top: -60,
            right: -50,
            child: Container(
              width: 220,
              height: 220,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                gradient: RadialGradient(colors: [
                  Colors.white.withValues(alpha: 0.07),
                  Colors.transparent,
                ]),
              ),
            ),
          ),
          SafeArea(
            bottom: false,
            child: Padding(
              padding: const EdgeInsets.fromLTRB(6, 6, 18, 20),
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
                          'Book Wi-Fi',
                          style: GoogleFonts.inter(
                            color: Colors.white,
                            fontSize: 22,
                            fontWeight: FontWeight.w900,
                            letterSpacing: -0.6,
                          ),
                        ),
                        const SizedBox(height: 3),
                        Text(
                          step < _stepNames.length
                              ? 'Step ${step + 1} of ${_stepNames.length} · ${_stepNames[step]}'
                              : 'Booking flow',
                          style: GoogleFonts.inter(
                              color: Colors.white60, fontSize: 13),
                        ),
                        const SizedBox(height: 10),
                        Wrap(
                          spacing: 8,
                          runSpacing: 6,
                          children: [
                            _chip(Icons.wifi_rounded,
                                selectedPlan?.name ?? 'No plan yet'),
                            _chip(Icons.calendar_month_rounded, durationLabel),
                            if (mobileText.isNotEmpty)
                              _chip(Icons.phone_rounded, mobileText),
                          ],
                        ),
                      ],
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

  Widget _chip(IconData icon, String label) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
      decoration: BoxDecoration(
        color: Colors.white.withValues(alpha: 0.13),
        borderRadius: BorderRadius.circular(999),
        border: Border.all(color: Colors.white.withValues(alpha: 0.2)),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 11, color: Colors.white70),
          const SizedBox(width: 5),
          Text(
            label,
            style: GoogleFonts.inter(
                color: Colors.white, fontSize: 11, fontWeight: FontWeight.w600),
          ),
        ],
      ),
    );
  }
}
