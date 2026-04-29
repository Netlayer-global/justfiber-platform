import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:geolocator/geolocator.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:image_picker/image_picker.dart';
import 'package:url_launcher/url_launcher.dart';

import '../core/app_state.dart';
import '../core/models.dart';
import '../core/theme.dart';

class SalesBookingScreen extends StatefulWidget {
  const SalesBookingScreen({super.key});

  @override
  State<SalesBookingScreen> createState() => _SalesBookingScreenState();
}

class _SalesBookingScreenState extends State<SalesBookingScreen> {
  int _step = 0;

  // Step 0 – Customer info
  final _nameCtrl = TextEditingController();
  final _mobileCtrl = TextEditingController();
  final _emailCtrl = TextEditingController();
  final _formKey0 = GlobalKey<FormState>();

  // Step 1 – Address + location
  final _addressCtrl = TextEditingController();
  final _pinCtrl = TextEditingController();
  final _formKey1 = GlobalKey<FormState>();
  double? _lat;
  double? _lng;
  bool _locationBusy = false;
  String? _locationError;

  // Step 2 – KYC
  final _aadhaarNumCtrl = TextEditingController();
  Uint8List? _aadhaarFrontBytes;
  Uint8List? _aadhaarBackBytes;
  Uint8List? _selfieBytes;

  // Step 3 – Plan
  List<SalesPlan>? _plans;
  bool _plansBusy = false;
  String? _plansError;
  String? _selectedPlanCode;
  SalesPlan? get _selectedPlan =>
      _plans?.where((p) => p.planCode == _selectedPlanCode).firstOrNull;

  // Step 4 – Duration
  int _durationMonths = 1;

  // Step 5 – Checkout & submit
  bool _submitting = false;
  String? _submitError;
  SalesLead? _createdLead;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted) _loadPlans();
    });
  }

  @override
  void dispose() {
    _nameCtrl.dispose();
    _mobileCtrl.dispose();
    _emailCtrl.dispose();
    _addressCtrl.dispose();
    _pinCtrl.dispose();
    _aadhaarNumCtrl.dispose();
    super.dispose();
  }

  Future<Uint8List?> _pickImage(ImageSource source) async {
    final file = await ImagePicker().pickImage(
      source: source,
      maxWidth: 1200,
      maxHeight: 1600,
      imageQuality: 75,
    );
    if (file == null) return null;
    return file.readAsBytes();
  }

  Future<void> _uploadKyc(String bookingNumber) async {
    final front = _aadhaarFrontBytes;
    final back = _aadhaarBackBytes;
    final selfie = _selfieBytes;
    if (front == null && back == null && selfie == null) return;
    try {
      final appState = InstallerStateScope.of(context);
      await appState.api.uploadBookingKyc(
        appState.session!,
        bookingNumber,
        aadhaarFront: front != null ? 'data:image/jpeg;base64,${base64Encode(front)}' : null,
        aadhaarBack: back != null ? 'data:image/jpeg;base64,${base64Encode(back)}' : null,
        selfie: selfie != null ? 'data:image/jpeg;base64,${base64Encode(selfie)}' : null,
        documentNumber: _aadhaarNumCtrl.text.trim().isEmpty ? null : _aadhaarNumCtrl.text.trim(),
      );
    } catch (_) {
      // KYC upload is best-effort — booking is already created
    }
  }

  Future<void> _loadPlans() async {
    setState(() {
      _plansBusy = true;
      _plansError = null;
    });
    try {
      final appState = InstallerStateScope.of(context);
      final session = appState.session;
      if (session == null) {
        throw 'Installer session not found. Please login again.';
      }
      final plans = await appState.api.fetchSalesPlans(session);
      if (mounted) setState(() => _plans = plans);
    } catch (e) {
      if (mounted) setState(() => _plansError = e.toString());
    } finally {
      if (mounted) setState(() => _plansBusy = false);
    }
  }

  Future<void> _pingLocation() async {
    setState(() {
      _locationBusy = true;
      _locationError = null;
    });
    try {
      var permission = await Geolocator.checkPermission();
      if (permission == LocationPermission.denied) {
        permission = await Geolocator.requestPermission();
      }
      if (permission == LocationPermission.deniedForever) {
        throw 'Location permission permanently denied. Enable it in Settings.';
      }
      if (permission == LocationPermission.denied) {
        throw 'Location permission denied.';
      }
      final serviceEnabled = await Geolocator.isLocationServiceEnabled();
      if (!serviceEnabled) throw 'Location services are disabled on this device.';

      final pos = await Geolocator.getCurrentPosition(
        locationSettings: const LocationSettings(
          accuracy: LocationAccuracy.high,
          timeLimit: Duration(seconds: 15),
        ),
      );
      if (mounted) {
        setState(() {
          _lat = pos.latitude;
          _lng = pos.longitude;
        });
      }
    } catch (e) {
      if (mounted) setState(() => _locationError = e.toString());
    } finally {
      if (mounted) setState(() => _locationBusy = false);
    }
  }

  Future<void> _submit(String paymentMode) async {
    final plan = _selectedPlan;
    if (plan == null) return;
    if (_lat == null) {
      final proceed = await showDialog<bool>(
        context: context,
        builder: (ctx) => AlertDialog(
          title: const Text('Location not pinned'),
          content: const Text(
              'GPS location was not captured. Booking will be created without coordinates. Continue?'),
          actions: [
            TextButton(
                onPressed: () => Navigator.of(ctx).pop(false),
                child: const Text('Go back')),
            FilledButton(
                onPressed: () => Navigator.of(ctx).pop(true),
                child: const Text('Continue anyway')),
          ],
        ),
      );
      if (!mounted || proceed != true) return;
    }
    setState(() {
      _submitting = true;
      _submitError = null;
    });
    try {
      final appState = InstallerStateScope.of(context);
      final totalAmount =
          plan.monthlyPrice * _durationMonths + plan.otcCharge;
      final lead = await appState.api.createSalesBooking(
        fullName: _nameCtrl.text.trim(),
        mobile: _mobileCtrl.text.trim(),
        email: _emailCtrl.text.trim().isEmpty ? null : _emailCtrl.text.trim(),
        address: _addressCtrl.text.trim(),
        pinCode: _pinCtrl.text.trim().isEmpty ? '000000' : _pinCtrl.text.trim(),
        lat: _lat ?? 0.0,
        lng: _lng ?? 0.0,
        planCode: plan.planCode,
        planName: plan.planName,
        totalAmount: totalAmount,
        durationMonths: _durationMonths,
        paymentMode: paymentMode,
      );
      await appState.addSalesLead(lead);
      await _uploadKyc(lead.bookingNumber);
      if (mounted) setState(() => _createdLead = lead);
    } catch (e) {
      if (mounted) setState(() => _submitError = e.toString());
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: kBg,
      appBar: AppBar(
        backgroundColor: kBg,
        surfaceTintColor: Colors.transparent,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_ios_new_rounded,
              color: kText, size: 18),
          onPressed: () {
            if (_step > 0 && _createdLead == null) {
              setState(() => _step--);
            } else {
              Navigator.of(context).pop();
            }
          },
        ),
        title: Text(
          _createdLead != null
              ? 'Booking Created'
              : 'New Booking  ${_step + 1}/6',
          style: GoogleFonts.inter(
            color: kText,
            fontSize: 16,
            fontWeight: FontWeight.w800,
          ),
        ),
        bottom: _createdLead == null
            ? PreferredSize(
                preferredSize: const Size.fromHeight(4),
                child: LinearProgressIndicator(
                  value: (_step + 1) / 6,
                  backgroundColor: kSurface2,
                  color: kPrimary,
                  minHeight: 3,
                ),
              )
            : null,
      ),
      body: _createdLead != null
          ? _SuccessView(lead: _createdLead!, onDone: () => Navigator.of(context).pop())
          : _buildStep(),
    );
  }

  Widget _buildStep() {
    switch (_step) {
      case 0:
        return _CustomerInfoStep(
          formKey: _formKey0,
          nameCtrl: _nameCtrl,
          mobileCtrl: _mobileCtrl,
          emailCtrl: _emailCtrl,
          onNext: () {
            if (_formKey0.currentState!.validate()) {
              setState(() => _step = 1);
            }
          },
        );
      case 1:
        return _AddressStep(
          formKey: _formKey1,
          addressCtrl: _addressCtrl,
          pinCtrl: _pinCtrl,
          lat: _lat,
          lng: _lng,
          locationBusy: _locationBusy,
          locationError: _locationError,
          onPingLocation: _pingLocation,
          onNext: () {
            if (_formKey1.currentState!.validate()) {
              setState(() => _step = 2);
            }
          },
        );
      case 2:
        return _KycStep(
          aadhaarNumCtrl: _aadhaarNumCtrl,
          frontBytes: _aadhaarFrontBytes,
          backBytes: _aadhaarBackBytes,
          selfieBytes: _selfieBytes,
          onPickFront: () async {
            final bytes = await _pickImage(ImageSource.camera);
            if (bytes != null && mounted) setState(() => _aadhaarFrontBytes = bytes);
          },
          onPickBack: () async {
            final bytes = await _pickImage(ImageSource.camera);
            if (bytes != null && mounted) setState(() => _aadhaarBackBytes = bytes);
          },
          onPickSelfie: () async {
            final bytes = await _pickImage(ImageSource.camera);
            if (bytes != null && mounted) setState(() => _selfieBytes = bytes);
          },
          onNext: () => setState(() => _step = 3),
        );
      case 3:
        return _PlanStep(
          plans: _plans,
          busy: _plansBusy,
          error: _plansError,
          selectedPlanCode: _selectedPlanCode,
          onRetry: _loadPlans,
          onSelect: (code) => setState(() => _selectedPlanCode = code),
          onNext: _selectedPlanCode != null
              ? () => setState(() => _step = 4)
              : null,
        );
      case 4:
        return _DurationStep(
          selectedMonths: _durationMonths,
          plan: _selectedPlan,
          onSelect: (months) => setState(() => _durationMonths = months),
          onNext: () => setState(() => _step = 5),
        );
      case 5:
        return _CheckoutStep(
          name: _nameCtrl.text.trim(),
          mobile: _mobileCtrl.text.trim(),
          address: _addressCtrl.text.trim(),
          plan: _selectedPlan!,
          durationMonths: _durationMonths,
          hasLocation: _lat != null,
          submitting: _submitting,
          error: _submitError,
          onCash: () => _submit('cash'),
          onPaymentLink: () => _submit('razorpay'),
        );
      default:
        return const SizedBox.shrink();
    }
  }
}

// ─── Step 0: Customer Info ────────────────────────────────────────────────────

class _CustomerInfoStep extends StatelessWidget {
  const _CustomerInfoStep({
    required this.formKey,
    required this.nameCtrl,
    required this.mobileCtrl,
    required this.emailCtrl,
    required this.onNext,
  });

  final GlobalKey<FormState> formKey;
  final TextEditingController nameCtrl;
  final TextEditingController mobileCtrl;
  final TextEditingController emailCtrl;
  final VoidCallback onNext;

  @override
  Widget build(BuildContext context) {
    return SingleChildScrollView(
      padding: const EdgeInsets.all(20),
      child: Form(
        key: formKey,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            _StepHeader(
              icon: Icons.person_outline_rounded,
              title: 'Customer Details',
              subtitle: 'Enter the customer\'s contact information.',
            ),
            const SizedBox(height: 28),
            TextFormField(
              controller: nameCtrl,
              textCapitalization: TextCapitalization.words,
              style: GoogleFonts.inter(color: kText),
              decoration: const InputDecoration(
                labelText: 'Full Name',
                prefixIcon: Icon(Icons.badge_outlined),
              ),
              validator: (v) =>
                  (v ?? '').trim().isEmpty ? 'Name is required' : null,
            ),
            const SizedBox(height: 16),
            TextFormField(
              controller: mobileCtrl,
              keyboardType: TextInputType.phone,
              maxLength: 10,
              inputFormatters: [FilteringTextInputFormatter.digitsOnly],
              style: GoogleFonts.inter(color: kText),
              decoration: const InputDecoration(
                labelText: 'Mobile Number',
                prefixIcon: Icon(Icons.phone_outlined),
                counterText: '',
              ),
              validator: (v) {
                final val = (v ?? '').trim();
                if (val.isEmpty) return 'Mobile number is required';
                if (val.length < 10) return 'Enter a valid 10-digit number';
                return null;
              },
            ),
            const SizedBox(height: 16),
            TextFormField(
              controller: emailCtrl,
              keyboardType: TextInputType.emailAddress,
              style: GoogleFonts.inter(color: kText),
              decoration: const InputDecoration(
                labelText: 'Email (optional)',
                prefixIcon: Icon(Icons.email_outlined),
              ),
              validator: (v) {
                final val = (v ?? '').trim();
                if (val.isEmpty) return null;
                final emailRe = RegExp(r'^[^@\s]+@[^@\s]+\.[^@\s]+$');
                if (!emailRe.hasMatch(val)) return 'Enter a valid email address';
                return null;
              },
            ),
            const SizedBox(height: 32),
            _NextButton(label: 'Next: Address', onPressed: onNext),
          ],
        ),
      ),
    );
  }
}

// ─── Step 1: Address + Location ───────────────────────────────────────────────

class _AddressStep extends StatelessWidget {
  const _AddressStep({
    required this.formKey,
    required this.addressCtrl,
    required this.pinCtrl,
    required this.lat,
    required this.lng,
    required this.locationBusy,
    required this.locationError,
    required this.onPingLocation,
    required this.onNext,
  });

  final GlobalKey<FormState> formKey;
  final TextEditingController addressCtrl;
  final TextEditingController pinCtrl;
  final double? lat;
  final double? lng;
  final bool locationBusy;
  final String? locationError;
  final VoidCallback onPingLocation;
  final VoidCallback onNext;

  @override
  Widget build(BuildContext context) {
    final hasLocation = lat != null && lng != null;
    return SingleChildScrollView(
      padding: const EdgeInsets.all(20),
      child: Form(
        key: formKey,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            _StepHeader(
              icon: Icons.location_on_outlined,
              title: 'Customer Address',
              subtitle: 'Enter the installation address and pin the location.',
            ),
            const SizedBox(height: 28),
            TextFormField(
              controller: addressCtrl,
              maxLines: 3,
              textCapitalization: TextCapitalization.sentences,
              style: GoogleFonts.inter(color: kText),
              decoration: const InputDecoration(
                labelText: 'Full Address',
                prefixIcon: Padding(
                  padding: EdgeInsets.only(bottom: 40),
                  child: Icon(Icons.home_outlined),
                ),
                alignLabelWithHint: true,
              ),
              validator: (v) =>
                  (v ?? '').trim().isEmpty ? 'Address is required' : null,
            ),
            const SizedBox(height: 16),
            TextFormField(
              controller: pinCtrl,
              keyboardType: TextInputType.number,
              maxLength: 6,
              inputFormatters: [FilteringTextInputFormatter.digitsOnly],
              style: GoogleFonts.inter(color: kText),
              decoration: const InputDecoration(
                labelText: 'Pin Code',
                prefixIcon: Icon(Icons.pin_drop_outlined),
                counterText: '',
              ),
              validator: (v) {
                final val = (v ?? '').trim();
                if (val.isEmpty) return 'Pin code is required';
                if (val.length < 6) return 'Enter a valid 6-digit pin code';
                return null;
              },
            ),
            const SizedBox(height: 16),
            // Location card
            Container(
              width: double.infinity,
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                color: hasLocation
                    ? const Color(0xFF10B981).withValues(alpha: 0.08)
                    : kSurface,
                borderRadius: BorderRadius.circular(16),
                border: Border.all(
                  color: hasLocation
                      ? const Color(0xFF10B981).withValues(alpha: 0.4)
                      : kBorder,
                ),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Icon(
                        hasLocation
                            ? Icons.location_on_rounded
                            : Icons.location_off_outlined,
                        color: hasLocation
                            ? const Color(0xFF10B981)
                            : kMuted,
                        size: 18,
                      ),
                      const SizedBox(width: 8),
                      Text(
                        hasLocation ? 'Location Pinned' : 'Location Not Pinned',
                        style: GoogleFonts.inter(
                          color: hasLocation
                              ? const Color(0xFF10B981)
                              : kMuted,
                          fontSize: 13,
                          fontWeight: FontWeight.w800,
                        ),
                      ),
                    ],
                  ),
                  if (hasLocation) ...[
                    const SizedBox(height: 6),
                    Text(
                      '${lat!.toStringAsFixed(6)}, ${lng!.toStringAsFixed(6)}',
                      style: GoogleFonts.inter(
                          color: kMuted, fontSize: 11),
                    ),
                  ] else ...[
                    const SizedBox(height: 4),
                    Text(
                      'Tap below to fetch your current GPS location.',
                      style: GoogleFonts.inter(color: kMuted, fontSize: 12),
                    ),
                  ],
                  const SizedBox(height: 12),
                  Row(
                    children: [
                      Expanded(
                        child: FilledButton.icon(
                          onPressed: locationBusy ? null : onPingLocation,
                          style: FilledButton.styleFrom(
                            backgroundColor: hasLocation
                                ? const Color(0xFF10B981)
                                : kPrimary,
                            padding:
                                const EdgeInsets.symmetric(vertical: 12),
                          ),
                          icon: locationBusy
                              ? const SizedBox(
                                  width: 16,
                                  height: 16,
                                  child: CircularProgressIndicator(
                                      strokeWidth: 2,
                                      color: Colors.white),
                                )
                              : Icon(
                                  hasLocation
                                      ? Icons.refresh_rounded
                                      : Icons.my_location_rounded,
                                  size: 18,
                                ),
                          label: Text(
                            locationBusy
                                ? 'Fetching...'
                                : hasLocation
                                    ? 'Re-fetch Location'
                                    : 'Fetch Current Location',
                            style: GoogleFonts.inter(
                                fontSize: 13,
                                fontWeight: FontWeight.w700),
                          ),
                        ),
                      ),
                      if (hasLocation) ...[
                        const SizedBox(width: 10),
                        OutlinedButton.icon(
                          onPressed: () => launchUrl(
                            Uri.parse(
                                'https://maps.google.com/?q=${lat!},${lng!}'),
                            mode: LaunchMode.externalApplication,
                          ),
                          style: OutlinedButton.styleFrom(
                            foregroundColor:
                                const Color(0xFF0EA5E9),
                            side: const BorderSide(
                                color: Color(0xFF0EA5E9)),
                            padding: const EdgeInsets.symmetric(
                                vertical: 12, horizontal: 14),
                          ),
                          icon: const Icon(Icons.map_rounded, size: 16),
                          label: Text('Map',
                              style: GoogleFonts.inter(
                                  fontSize: 13,
                                  fontWeight: FontWeight.w700)),
                        ),
                      ],
                    ],
                  ),
                  if (locationError != null) ...[
                    const SizedBox(height: 8),
                    Text(
                      locationError!,
                      style: GoogleFonts.inter(
                          color: const Color(0xFFEF4444), fontSize: 12),
                    ),
                  ],
                ],
              ),
            ),
            const SizedBox(height: 32),
            _NextButton(label: 'Next: KYC', onPressed: onNext),
          ],
        ),
      ),
    );
  }
}

// ─── Step 2: KYC ─────────────────────────────────────────────────────────────

class _KycStep extends StatelessWidget {
  const _KycStep({
    required this.aadhaarNumCtrl,
    required this.frontBytes,
    required this.backBytes,
    required this.selfieBytes,
    required this.onPickFront,
    required this.onPickBack,
    required this.onPickSelfie,
    required this.onNext,
  });

  final TextEditingController aadhaarNumCtrl;
  final Uint8List? frontBytes;
  final Uint8List? backBytes;
  final Uint8List? selfieBytes;
  final VoidCallback onPickFront;
  final VoidCallback onPickBack;
  final VoidCallback onPickSelfie;
  final VoidCallback onNext;

  @override
  Widget build(BuildContext context) {
    return SingleChildScrollView(
      padding: const EdgeInsets.all(20),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          _StepHeader(
            icon: Icons.badge_outlined,
            title: 'KYC Documents',
            subtitle: 'Capture Aadhaar and selfie. You can skip and do this later.',
          ),
          const SizedBox(height: 28),
          TextFormField(
            controller: aadhaarNumCtrl,
            keyboardType: TextInputType.number,
            maxLength: 12,
            inputFormatters: [FilteringTextInputFormatter.digitsOnly],
            style: GoogleFonts.inter(color: kText),
            decoration: const InputDecoration(
              labelText: 'Aadhaar Number (optional)',
              prefixIcon: Icon(Icons.numbers_rounded),
              counterText: '',
            ),
          ),
          const SizedBox(height: 24),
          _ImageSlot(
            label: 'Aadhaar Front',
            icon: Icons.credit_card_rounded,
            bytes: frontBytes,
            onTap: onPickFront,
          ),
          const SizedBox(height: 14),
          _ImageSlot(
            label: 'Aadhaar Back',
            icon: Icons.credit_card_outlined,
            bytes: backBytes,
            onTap: onPickBack,
          ),
          const SizedBox(height: 14),
          _ImageSlot(
            label: 'Customer Selfie',
            icon: Icons.face_rounded,
            bytes: selfieBytes,
            onTap: onPickSelfie,
          ),
          const SizedBox(height: 32),
          _NextButton(label: 'Next: Select Plan', onPressed: onNext),
          const SizedBox(height: 12),
          SizedBox(
            width: double.infinity,
            child: OutlinedButton(
              onPressed: onNext,
              child: Text(
                'Skip KYC for now',
                style: GoogleFonts.inter(
                    fontSize: 14, fontWeight: FontWeight.w600),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _ImageSlot extends StatelessWidget {
  const _ImageSlot({
    required this.label,
    required this.icon,
    required this.bytes,
    required this.onTap,
  });

  final String label;
  final IconData icon;
  final Uint8List? bytes;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final captured = bytes != null;
    return GestureDetector(
      onTap: onTap,
      child: Container(
        height: 100,
        decoration: BoxDecoration(
          color: captured
              ? const Color(0xFF10B981).withValues(alpha: 0.06)
              : kSurface,
          borderRadius: BorderRadius.circular(16),
          border: Border.all(
            color: captured
                ? const Color(0xFF10B981).withValues(alpha: 0.5)
                : kBorder,
            width: captured ? 1.5 : 1,
          ),
        ),
        clipBehavior: Clip.antiAlias,
        child: captured
            ? Stack(
                fit: StackFit.expand,
                children: [
                  Image.memory(bytes!, fit: BoxFit.cover),
                  Positioned(
                    top: 6,
                    right: 6,
                    child: Container(
                      padding: const EdgeInsets.symmetric(
                          horizontal: 8, vertical: 4),
                      decoration: BoxDecoration(
                        color: const Color(0xFF10B981),
                        borderRadius: BorderRadius.circular(20),
                      ),
                      child: Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          const Icon(Icons.check_rounded,
                              color: Colors.white, size: 12),
                          const SizedBox(width: 4),
                          Text(label,
                              style: GoogleFonts.inter(
                                  color: Colors.white,
                                  fontSize: 10,
                                  fontWeight: FontWeight.w700)),
                        ],
                      ),
                    ),
                  ),
                  Positioned(
                    bottom: 6,
                    right: 6,
                    child: Container(
                      padding: const EdgeInsets.symmetric(
                          horizontal: 8, vertical: 4),
                      decoration: BoxDecoration(
                        color: Colors.black54,
                        borderRadius: BorderRadius.circular(20),
                      ),
                      child: Text('Retake',
                          style: GoogleFonts.inter(
                              color: Colors.white,
                              fontSize: 10,
                              fontWeight: FontWeight.w600)),
                    ),
                  ),
                ],
              )
            : Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Icon(icon, color: kMuted, size: 28),
                  const SizedBox(width: 12),
                  Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        label,
                        style: GoogleFonts.inter(
                          color: kText,
                          fontSize: 14,
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                      const SizedBox(height: 2),
                      Text(
                        'Tap to capture with camera',
                        style: GoogleFonts.inter(
                            color: kMuted, fontSize: 12),
                      ),
                    ],
                  ),
                  const Spacer(),
                  const Padding(
                    padding: EdgeInsets.only(right: 16),
                    child: Icon(Icons.camera_alt_outlined,
                        color: kSubtle, size: 22),
                  ),
                ],
              ),
      ),
    );
  }
}

// ─── Step 3: Plan Selection ────────────────────────────────────────────────────

class _PlanStep extends StatefulWidget {
  const _PlanStep({
    required this.plans,
    required this.busy,
    required this.error,
    required this.selectedPlanCode,
    required this.onRetry,
    required this.onSelect,
    required this.onNext,
  });

  final List<SalesPlan>? plans;
  final bool busy;
  final String? error;
  final String? selectedPlanCode;
  final VoidCallback onRetry;
  final ValueChanged<String> onSelect;
  final VoidCallback? onNext;

  @override
  State<_PlanStep> createState() => _PlanStepState();
}

class _PlanStepState extends State<_PlanStep> {
  final _searchCtrl = TextEditingController();
  String _query = '';

  @override
  void dispose() {
    _searchCtrl.dispose();
    super.dispose();
  }

  List<SalesPlan> _filtered(List<SalesPlan> plans) {
    final q = _query.toLowerCase().trim();
    if (q.isEmpty) return plans;
    return plans.where((p) {
      return p.planName.toLowerCase().contains(q) ||
          p.downloadSpeedMbps.toInt().toString().contains(q) ||
          p.tags.any((t) => t.toLowerCase().contains(q));
    }).toList();
  }

  @override
  Widget build(BuildContext context) {
    final filtered = _filtered(widget.plans ?? []);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(20, 20, 20, 8),
          child: _StepHeader(
            icon: Icons.grid_view_rounded,
            title: 'Select Plan',
            subtitle: 'Choose the fiber plan for this customer.',
          ),
        ),
        Padding(
          padding: const EdgeInsets.fromLTRB(16, 0, 16, 12),
          child: TextField(
            controller: _searchCtrl,
            style: GoogleFonts.inter(color: kText, fontSize: 14),
            decoration: InputDecoration(
              hintText: 'Search plans…',
              hintStyle: GoogleFonts.inter(color: kSubtle, fontSize: 14),
              prefixIcon: const Icon(Icons.search_rounded, size: 20),
              suffixIcon: _query.isNotEmpty
                  ? IconButton(
                      icon: const Icon(Icons.clear_rounded, size: 18),
                      onPressed: () => setState(() {
                        _searchCtrl.clear();
                        _query = '';
                      }),
                    )
                  : null,
              isDense: true,
              contentPadding: const EdgeInsets.symmetric(vertical: 12),
            ),
            onChanged: (v) => setState(() => _query = v),
          ),
        ),
        if (widget.busy)
          const Expanded(
            child: Center(
              child: CircularProgressIndicator(color: kPrimaryLight),
            ),
          )
        else if (widget.error != null)
          Expanded(
            child: Center(
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Text(widget.error!,
                      style: GoogleFonts.inter(
                          color: const Color(0xFFEF4444), fontSize: 13)),
                  const SizedBox(height: 12),
                  OutlinedButton(
                      onPressed: widget.onRetry,
                      child: const Text('Retry')),
                ],
              ),
            ),
          )
        else if (widget.plans != null)
          Expanded(
            child: filtered.isEmpty
                ? Center(
                    child: Text('No plans match "$_query"',
                        style: GoogleFonts.inter(color: kMuted, fontSize: 13)),
                  )
                : ListView.separated(
                    padding: const EdgeInsets.fromLTRB(16, 0, 16, 16),
                    itemCount: filtered.length,
                    separatorBuilder: (_, __) => const SizedBox(height: 10),
                    itemBuilder: (context, index) {
                      final plan = filtered[index];
                      final selected = plan.planCode == widget.selectedPlanCode;
                      return _PlanCard(
                        plan: plan,
                        selected: selected,
                        onTap: () => widget.onSelect(plan.planCode),
                      );
                    },
                  ),
          ),
        Padding(
          padding: const EdgeInsets.fromLTRB(16, 8, 16, 24),
          child: _NextButton(
            label: 'Next: Duration',
            onPressed: widget.onNext,
          ),
        ),
      ],
    );
  }
}

class _PlanCard extends StatelessWidget {
  const _PlanCard({
    required this.plan,
    required this.selected,
    required this.onTap,
  });

  final SalesPlan plan;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 180),
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: selected ? kPrimary.withValues(alpha: 0.1) : kSurface,
          borderRadius: BorderRadius.circular(18),
          border: Border.all(
            color: selected ? kPrimary : kBorder,
            width: selected ? 1.5 : 1,
          ),
        ),
        child: Row(
          children: [
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    plan.planName,
                    style: GoogleFonts.inter(
                      color: kText,
                      fontSize: 15,
                      fontWeight: FontWeight.w800,
                    ),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    '${plan.downloadSpeedMbps.toInt()} Mbps  •  ${plan.dataPolicy == 'unlimited' ? 'Unlimited' : '${plan.dataLimitGb.toInt()} GB'}',
                    style: GoogleFonts.inter(color: kMuted, fontSize: 12),
                  ),
                  if (plan.tags.isNotEmpty) ...[
                    const SizedBox(height: 6),
                    Wrap(
                      spacing: 6,
                      children: plan.tags
                          .take(3)
                          .map((tag) => Container(
                                padding: const EdgeInsets.symmetric(
                                    horizontal: 8, vertical: 2),
                                decoration: BoxDecoration(
                                  color: kSurface2,
                                  borderRadius: BorderRadius.circular(20),
                                ),
                                child: Text(tag,
                                    style: GoogleFonts.inter(
                                        color: kMuted, fontSize: 10)),
                              ))
                          .toList(),
                    ),
                  ],
                ],
              ),
            ),
            const SizedBox(width: 12),
            Column(
              crossAxisAlignment: CrossAxisAlignment.end,
              children: [
                Text(
                  '₹${plan.monthlyPrice.toInt()}',
                  style: GoogleFonts.inter(
                    color: selected ? kPrimaryLight : kText,
                    fontSize: 20,
                    fontWeight: FontWeight.w900,
                  ),
                ),
                Text(
                  '/month',
                  style: GoogleFonts.inter(color: kSubtle, fontSize: 11),
                ),
                if (plan.otcCharge > 0) ...[
                  const SizedBox(height: 2),
                  Text(
                    '+₹${plan.otcCharge.toInt()} OTC',
                    style:
                        GoogleFonts.inter(color: kSubtle, fontSize: 11),
                  ),
                ],
              ],
            ),
            const SizedBox(width: 8),
            AnimatedContainer(
              duration: const Duration(milliseconds: 180),
              width: 22,
              height: 22,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                color: selected ? kPrimary : Colors.transparent,
                border: Border.all(
                  color: selected ? kPrimary : kSubtle,
                  width: 1.5,
                ),
              ),
              child: selected
                  ? const Icon(Icons.check_rounded,
                      color: Colors.white, size: 14)
                  : null,
            ),
          ],
        ),
      ),
    );
  }
}

// ─── Step 3: Duration ─────────────────────────────────────────────────────────

class _DurationStep extends StatelessWidget {
  const _DurationStep({
    required this.selectedMonths,
    required this.plan,
    required this.onSelect,
    required this.onNext,
  });

  final int selectedMonths;
  final SalesPlan? plan;
  final ValueChanged<int> onSelect;
  final VoidCallback onNext;

  static const _options = [
    (1, '1 Month'),
    (3, '3 Months'),
    (6, '6 Months'),
    (12, '12 Months'),
  ];

  @override
  Widget build(BuildContext context) {
    return SingleChildScrollView(
      padding: const EdgeInsets.all(20),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          _StepHeader(
            icon: Icons.calendar_today_outlined,
            title: 'Subscription Duration',
            subtitle: 'How many months does the customer want to subscribe?',
          ),
          const SizedBox(height: 28),
          ...(_options.map((opt) {
            final months = opt.$1;
            final label = opt.$2;
            final selected = months == selectedMonths;
            final total = plan != null
                ? plan!.monthlyPrice * months + plan!.otcCharge
                : 0.0;
            return Padding(
              padding: const EdgeInsets.only(bottom: 10),
              child: GestureDetector(
                onTap: () => onSelect(months),
                child: AnimatedContainer(
                  duration: const Duration(milliseconds: 160),
                  padding: const EdgeInsets.all(16),
                  decoration: BoxDecoration(
                    color: selected ? kPrimary.withValues(alpha: 0.1) : kSurface,
                    borderRadius: BorderRadius.circular(16),
                    border: Border.all(
                      color: selected ? kPrimary : kBorder,
                      width: selected ? 1.5 : 1,
                    ),
                  ),
                  child: Row(
                    children: [
                      Expanded(
                        child: Text(
                          label,
                          style: GoogleFonts.inter(
                            color: kText,
                            fontSize: 15,
                            fontWeight: FontWeight.w700,
                          ),
                        ),
                      ),
                      if (plan != null)
                        Text(
                          '₹${total.toInt()}',
                          style: GoogleFonts.inter(
                            color: selected ? kPrimaryLight : kMuted,
                            fontSize: 16,
                            fontWeight: FontWeight.w800,
                          ),
                        ),
                      const SizedBox(width: 10),
                      AnimatedContainer(
                        duration: const Duration(milliseconds: 160),
                        width: 22,
                        height: 22,
                        decoration: BoxDecoration(
                          shape: BoxShape.circle,
                          color: selected ? kPrimary : Colors.transparent,
                          border: Border.all(
                            color: selected ? kPrimary : kSubtle,
                            width: 1.5,
                          ),
                        ),
                        child: selected
                            ? const Icon(Icons.check_rounded,
                                color: Colors.white, size: 14)
                            : null,
                      ),
                    ],
                  ),
                ),
              ),
            );
          })),
          const SizedBox(height: 24),
          _NextButton(label: 'Next: Checkout', onPressed: onNext),
        ],
      ),
    );
  }
}

// ─── Step 4: Checkout ─────────────────────────────────────────────────────────

class _CheckoutStep extends StatelessWidget {
  const _CheckoutStep({
    required this.name,
    required this.mobile,
    required this.address,
    required this.plan,
    required this.durationMonths,
    required this.hasLocation,
    required this.submitting,
    required this.error,
    required this.onCash,
    required this.onPaymentLink,
  });

  final String name;
  final String mobile;
  final String address;
  final SalesPlan plan;
  final int durationMonths;
  final bool hasLocation;
  final bool submitting;
  final String? error;
  final VoidCallback onCash;
  final VoidCallback onPaymentLink;

  @override
  Widget build(BuildContext context) {
    final totalAmount = plan.monthlyPrice * durationMonths + plan.otcCharge;
    return SingleChildScrollView(
      padding: const EdgeInsets.all(20),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          _StepHeader(
            icon: Icons.receipt_long_outlined,
            title: 'Booking Summary',
            subtitle: 'Review and choose a payment method.',
          ),
          const SizedBox(height: 24),
          // Summary card
          Container(
            padding: const EdgeInsets.all(18),
            decoration: BoxDecoration(
              color: kSurface,
              borderRadius: BorderRadius.circular(20),
              border: Border.all(color: kBorder),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                _SummaryRow(label: 'Customer', value: name),
                const SizedBox(height: 8),
                _SummaryRow(label: 'Mobile', value: '+91 $mobile'),
                const SizedBox(height: 8),
                _SummaryRow(label: 'Address', value: address),
                const SizedBox(height: 8),
                _SummaryRow(
                  label: 'Location',
                  value: hasLocation ? 'Pinned ✓' : 'Not pinned',
                  valueColor: hasLocation
                      ? const Color(0xFF10B981)
                      : const Color(0xFFF59E0B),
                ),
                Padding(
                  padding: const EdgeInsets.symmetric(vertical: 12),
                  child: Container(height: 1, color: kDivider),
                ),
                _SummaryRow(label: 'Plan', value: plan.planName),
                const SizedBox(height: 8),
                _SummaryRow(
                  label: 'Duration',
                  value:
                      '$durationMonths month${durationMonths > 1 ? 's' : ''}',
                ),
                const SizedBox(height: 8),
                _SummaryRow(
                  label: 'Monthly',
                  value: '₹${plan.monthlyPrice.toInt()}',
                ),
                if (plan.otcCharge > 0) ...[
                  const SizedBox(height: 8),
                  _SummaryRow(
                    label: 'One-time charge',
                    value: '₹${plan.otcCharge.toInt()}',
                  ),
                ],
                Padding(
                  padding: const EdgeInsets.symmetric(vertical: 12),
                  child: Container(height: 1, color: kDivider),
                ),
                _SummaryRow(
                  label: 'Total Amount',
                  value: '₹${totalAmount.toInt()}',
                  bold: true,
                  valueColor: kPrimaryLight,
                ),
              ],
            ),
          ),
          if (error != null) ...[
            const SizedBox(height: 14),
            Container(
              padding: const EdgeInsets.all(14),
              decoration: BoxDecoration(
                color: const Color(0xFFEF4444).withValues(alpha: 0.1),
                borderRadius: BorderRadius.circular(14),
                border: Border.all(
                    color: const Color(0xFFEF4444).withValues(alpha: 0.3)),
              ),
              child: Text(
                error!,
                style:
                    GoogleFonts.inter(color: const Color(0xFFEF4444), fontSize: 13),
              ),
            ),
          ],
          const SizedBox(height: 28),
          Text(
            'PAYMENT METHOD',
            style: GoogleFonts.inter(
              color: kSubtle,
              fontSize: 10,
              fontWeight: FontWeight.w700,
              letterSpacing: 1.6,
            ),
          ),
          const SizedBox(height: 14),
          // Cash button
          SizedBox(
            width: double.infinity,
            child: FilledButton.icon(
              onPressed: submitting ? null : onCash,
              style: FilledButton.styleFrom(
                backgroundColor: const Color(0xFF10B981),
                padding: const EdgeInsets.symmetric(vertical: 16),
              ),
              icon: submitting
                  ? const SizedBox(
                      width: 18,
                      height: 18,
                      child: CircularProgressIndicator(
                          strokeWidth: 2, color: Colors.white),
                    )
                  : const Icon(Icons.payments_outlined, size: 20),
              label: Text(
                'Confirm — Cash Payment',
                style: GoogleFonts.inter(
                    fontSize: 15, fontWeight: FontWeight.w700),
              ),
            ),
          ),
          const SizedBox(height: 12),
          // Payment link button
          SizedBox(
            width: double.infinity,
            child: OutlinedButton.icon(
              onPressed: submitting ? null : onPaymentLink,
              style: OutlinedButton.styleFrom(
                foregroundColor: const Color(0xFF0EA5E9),
                side: const BorderSide(color: Color(0xFF0EA5E9)),
                padding: const EdgeInsets.symmetric(vertical: 16),
              ),
              icon: const Icon(Icons.link_rounded, size: 20),
              label: Text(
                'Generate Payment Link (SMS to customer)',
                style: GoogleFonts.inter(
                    fontSize: 14, fontWeight: FontWeight.w700),
              ),
            ),
          ),
          const SizedBox(height: 40),
        ],
      ),
    );
  }
}

class _SummaryRow extends StatelessWidget {
  const _SummaryRow({
    required this.label,
    required this.value,
    this.bold = false,
    this.valueColor,
  });

  final String label;
  final String value;
  final bool bold;
  final Color? valueColor;

  @override
  Widget build(BuildContext context) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        SizedBox(
          width: 120,
          child: Text(
            label,
            style: GoogleFonts.inter(color: kSubtle, fontSize: 13),
          ),
        ),
        Expanded(
          child: Text(
            value,
            style: GoogleFonts.inter(
              color: valueColor ?? kText,
              fontSize: 13,
              fontWeight: bold ? FontWeight.w800 : FontWeight.w600,
            ),
          ),
        ),
      ],
    );
  }
}

// ─── Success View ─────────────────────────────────────────────────────────────

class _SuccessView extends StatelessWidget {
  const _SuccessView({required this.lead, required this.onDone});
  final SalesLead lead;
  final VoidCallback onDone;

  @override
  Widget build(BuildContext context) {
    final isCash = lead.paymentMode == 'cash';
    return SingleChildScrollView(
      padding: const EdgeInsets.all(24),
      child: Column(
        children: [
          const SizedBox(height: 20),
          Container(
            width: 80,
            height: 80,
            decoration: BoxDecoration(
              color: const Color(0xFF10B981).withValues(alpha: 0.15),
              shape: BoxShape.circle,
            ),
            child: const Icon(Icons.check_circle_outline_rounded,
                color: Color(0xFF10B981), size: 40),
          ),
          const SizedBox(height: 20),
          Text(
            'Booking Created!',
            style: GoogleFonts.inter(
              color: kText,
              fontSize: 24,
              fontWeight: FontWeight.w900,
            ),
          ),
          const SizedBox(height: 8),
          Text(
            isCash
                ? 'Cash booking confirmed. An installer will be assigned shortly.'
                : 'Booking created. The customer can pay using the link sent to their mobile.',
            textAlign: TextAlign.center,
            style: GoogleFonts.inter(color: kMuted, fontSize: 13, height: 1.5),
          ),
          const SizedBox(height: 28),
          Container(
            width: double.infinity,
            padding: const EdgeInsets.all(18),
            decoration: BoxDecoration(
              color: kSurface,
              borderRadius: BorderRadius.circular(20),
              border: Border.all(color: kBorder),
            ),
            child: Column(
              children: [
                _SummaryRow(label: 'Booking #', value: lead.bookingNumber),
                const SizedBox(height: 8),
                _SummaryRow(label: 'Customer', value: lead.customerName),
                const SizedBox(height: 8),
                _SummaryRow(label: 'Mobile', value: '+91 ${lead.customerPhone}'),
                const SizedBox(height: 8),
                _SummaryRow(label: 'Plan', value: lead.planName),
                const SizedBox(height: 8),
                _SummaryRow(
                    label: 'Amount', value: '₹${lead.amount.toInt()}'),
                const SizedBox(height: 8),
                _SummaryRow(
                  label: 'Payment',
                  value: isCash ? 'Cash' : 'Online (link sent)',
                  valueColor: isCash
                      ? const Color(0xFF10B981)
                      : const Color(0xFF0EA5E9),
                ),
              ],
            ),
          ),
          const SizedBox(height: 16),
          SizedBox(
            width: double.infinity,
            child: OutlinedButton.icon(
              onPressed: () {
                Clipboard.setData(ClipboardData(text: lead.bookingNumber));
                ScaffoldMessenger.of(context).showSnackBar(
                  SnackBar(
                    content: Text('Booking number copied',
                        style: GoogleFonts.inter(fontSize: 13)),
                    duration: const Duration(seconds: 2),
                  ),
                );
              },
              icon: const Icon(Icons.copy_rounded, size: 16),
              label: Text('Copy Booking Number',
                  style: GoogleFonts.inter(
                      fontSize: 13, fontWeight: FontWeight.w700)),
            ),
          ),
          const SizedBox(height: 10),
          SizedBox(
            width: double.infinity,
            child: FilledButton.icon(
              style: FilledButton.styleFrom(
                  backgroundColor: const Color(0xFF25D366)),
              onPressed: () {
                final msg = 'Hi ${lead.customerName}, your JustFiber booking is confirmed!\n'
                    'Booking #: ${lead.bookingNumber}\n'
                    'Plan: ${lead.planName}\n'
                    'Amount: ₹${lead.amount.toInt()}\n'
                    'Payment: ${lead.paymentMode == 'cash' ? 'Cash' : 'Online link sent to your mobile'}\n'
                    'Our team will reach out shortly.';
                launchUrl(
                  Uri.parse(
                      'https://wa.me/91${lead.customerPhone}?text=${Uri.encodeComponent(msg)}'),
                  mode: LaunchMode.externalApplication,
                );
              },
              icon: const Icon(Icons.chat_rounded, size: 18),
              label: Text('Share on WhatsApp',
                  style: GoogleFonts.inter(
                      fontSize: 14, fontWeight: FontWeight.w700)),
            ),
          ),
          const SizedBox(height: 10),
          SizedBox(
            width: double.infinity,
            child: FilledButton(
              onPressed: onDone,
              child: Text('Done',
                  style: GoogleFonts.inter(
                      fontSize: 15, fontWeight: FontWeight.w700)),
            ),
          ),
        ],
      ),
    );
  }
}

// ─── Shared Widgets ───────────────────────────────────────────────────────────

class _StepHeader extends StatelessWidget {
  const _StepHeader({
    required this.icon,
    required this.title,
    required this.subtitle,
  });

  final IconData icon;
  final String title;
  final String subtitle;

  @override
  Widget build(BuildContext context) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Container(
          width: 48,
          height: 48,
          decoration: BoxDecoration(
            color: kPrimary.withValues(alpha: 0.12),
            borderRadius: BorderRadius.circular(14),
            border: Border.all(color: kPrimary.withValues(alpha: 0.2)),
          ),
          child: Icon(icon, color: kPrimaryLight, size: 22),
        ),
        const SizedBox(width: 14),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                title,
                style: GoogleFonts.inter(
                  color: kText,
                  fontSize: 20,
                  fontWeight: FontWeight.w900,
                  letterSpacing: -0.4,
                ),
              ),
              const SizedBox(height: 4),
              Text(
                subtitle,
                style: GoogleFonts.inter(
                    color: kMuted, fontSize: 13, height: 1.4),
              ),
            ],
          ),
        ),
      ],
    );
  }
}

class _NextButton extends StatelessWidget {
  const _NextButton({required this.label, required this.onPressed});

  final String label;
  final VoidCallback? onPressed;

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: double.infinity,
      child: FilledButton(
        onPressed: onPressed,
        child: Text(
          label,
          style: GoogleFonts.inter(fontSize: 15, fontWeight: FontWeight.w700),
        ),
      ),
    );
  }
}
