import 'package:flutter/material.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:geolocator/geolocator.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:latlong2/latlong.dart';

import '../core/app_state.dart';
import '../core/theme.dart';
import '../widgets/pressable_scale.dart';

/// Screen to request a connection shift / relocation.
/// Customer marks the new location on a map, fills basic address details
/// and submits an enquiry. Backed by the existing service-request API
/// (type = 'shift') so admin/NOC can pick it up.
class ShiftConnectionScreen extends StatefulWidget {
  const ShiftConnectionScreen({super.key});

  @override
  State<ShiftConnectionScreen> createState() => _ShiftConnectionScreenState();
}

class _ShiftConnectionScreenState extends State<ShiftConnectionScreen> {
  final _formKey = GlobalKey<FormState>();
  final _addrCtrl = TextEditingController();
  final _pinCtrl = TextEditingController();
  final _landmarkCtrl = TextEditingController();
  final _notesCtrl = TextEditingController();

  String _mode = 'new_address';

  // Map / location
  final MapController _mapCtrl = MapController();
  LatLng _location = const LatLng(28.6139, 77.2090);
  bool _locationPicked = false;
  bool _locationBusy = false;
  bool _serviceDisabled = false;
  bool _permDeniedForever = false;
  String? _locationError;

  bool _submitting = false;
  String? _submittedRef;

  @override
  void dispose() {
    _addrCtrl.dispose();
    _pinCtrl.dispose();
    _landmarkCtrl.dispose();
    _notesCtrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: kBg,
      appBar: AppBar(
        backgroundColor: kBg,
        elevation: 0,
        title: Text('Shift Connection',
            style: GoogleFonts.inter(
                fontWeight: FontWeight.w800, color: Colors.white)),
        iconTheme: const IconThemeData(color: Colors.white),
      ),
      body: _submittedRef != null
          ? _buildSuccess()
          : SafeArea(
              child: SingleChildScrollView(
                padding: const EdgeInsets.fromLTRB(18, 8, 18, 32),
                child: Form(
                  key: _formKey,
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      _intro(),
                      const SizedBox(height: 16),
                      _modeSelector(),
                      if (_mode == 'new_address') ...[
                        const SizedBox(height: 18),
                        _label('NEW LOCATION'),
                        const SizedBox(height: 8),
                        _mapCard(),
                        const SizedBox(height: 8),
                        _locationActions(),
                        if (_locationError != null) ...[
                          const SizedBox(height: 6),
                          Text(_locationError!,
                              style: GoogleFonts.inter(
                                  color: const Color(0xFFFCA5A5),
                                  fontSize: 12)),
                        ],
                        const SizedBox(height: 18),
                        _label('NEW ADDRESS'),
                        const SizedBox(height: 8),
                        _field(
                            controller: _addrCtrl,
                            hint: 'House / flat, street, area',
                            maxLines: 2,
                            validator: (v) => (v == null || v.trim().isEmpty)
                                ? 'Address is required'
                                : null),
                        const SizedBox(height: 12),
                        _field(
                            controller: _pinCtrl,
                            hint: 'Pincode',
                            keyboardType: TextInputType.number,
                            validator: (v) {
                              final t = v?.trim() ?? '';
                              if (t.isEmpty) return 'Pincode is required';
                              if (t.length != 6) return 'Enter a valid pincode';
                              return null;
                            }),
                        const SizedBox(height: 12),
                        _field(
                            controller: _landmarkCtrl,
                            hint: 'Landmark (optional)'),
                      ],
                      const SizedBox(height: 18),
                      _label('NOTES'),
                      const SizedBox(height: 8),
                      _field(
                          controller: _notesCtrl,
                          hint: _mode == 'new_address'
                              ? 'Preferred shift date / extra info'
                              : 'Where do you want the router moved?',
                          maxLines: 3),
                      const SizedBox(height: 22),
                      SizedBox(
                        width: double.infinity,
                        child: FilledButton.icon(
                          onPressed: _submitting ? null : _submit,
                          icon: _submitting
                              ? const SizedBox(
                                  width: 16,
                                  height: 16,
                                  child: CircularProgressIndicator(
                                      strokeWidth: 2, color: Colors.white))
                              : const Icon(Icons.send_rounded),
                          label: Text(
                              _submitting ? 'Submitting…' : 'Submit Request',
                              style: GoogleFonts.inter(
                                  fontWeight: FontWeight.w700)),
                          style: FilledButton.styleFrom(
                            backgroundColor: kPrimary,
                            padding:
                                const EdgeInsets.symmetric(vertical: 14),
                            shape: RoundedRectangleBorder(
                                borderRadius: BorderRadius.circular(14)),
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ),
    );
  }

  // ── Sections ──────────────────────────────────────────────────────────────

  Widget _intro() => Container(
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: kSurface,
          borderRadius: BorderRadius.circular(18),
          border: Border.all(color: kBorder),
        ),
        child: Row(
          children: [
            Container(
              width: 42,
              height: 42,
              decoration: BoxDecoration(
                color: const Color(0xFFFB923C).withValues(alpha: 0.15),
                borderRadius: BorderRadius.circular(12),
              ),
              child: const Icon(Icons.home_work_rounded,
                  color: Color(0xFFFB923C)),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text('Relocate your broadband',
                      style: GoogleFonts.inter(
                          color: Colors.white,
                          fontWeight: FontWeight.w800,
                          fontSize: 15)),
                  const SizedBox(height: 2),
                  Text(
                      'Tell us where you\'re moving and our team will check feasibility & schedule the shift.',
                      style: GoogleFonts.inter(
                          color: kMuted, fontSize: 12, height: 1.4)),
                ],
              ),
            ),
          ],
        ),
      );

  Widget _modeSelector() => Container(
        decoration: BoxDecoration(
          color: kSurface,
          borderRadius: BorderRadius.circular(18),
          border: Border.all(color: kBorder),
        ),
        child: Column(
          children: [
            _modeOption(
              value: 'new_address',
              title: 'Move to a new address',
              subtitle: 'Pin the new location on the map',
              icon: Icons.location_on_rounded,
            ),
            const Divider(height: 1, color: kBorder),
            _modeOption(
              value: 'same_address',
              title: 'Same address, different spot',
              subtitle: 'Re-route within your current home',
              icon: Icons.swap_horiz_rounded,
              last: true,
            ),
          ],
        ),
      );

  Widget _modeOption({
    required String value,
    required String title,
    required String subtitle,
    required IconData icon,
    bool last = false,
  }) {
    final selected = _mode == value;
    return PressableScale(
      onTap: () => setState(() => _mode = value),
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
        child: Row(
          children: [
            Container(
              width: 40,
              height: 40,
              decoration: BoxDecoration(
                color: selected
                    ? kPrimary.withValues(alpha: 0.18)
                    : Colors.white.withValues(alpha: 0.04),
                borderRadius: BorderRadius.circular(12),
              ),
              child: Icon(icon,
                  color: selected ? kPrimary : Colors.white70, size: 20),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(title,
                      style: GoogleFonts.inter(
                          color: Colors.white,
                          fontSize: 14,
                          fontWeight: FontWeight.w700)),
                  const SizedBox(height: 2),
                  Text(subtitle,
                      style: GoogleFonts.inter(
                          color: kMuted, fontSize: 12)),
                ],
              ),
            ),
            Container(
              width: 20,
              height: 20,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                color: selected ? kPrimary : Colors.transparent,
                border: Border.all(
                  color: selected ? kPrimary : kMuted,
                  width: 2,
                ),
              ),
              child: selected
                  ? const Icon(Icons.check_rounded,
                      color: Colors.white, size: 12)
                  : null,
            ),
          ],
        ),
      ),
    );
  }

  Widget _mapCard() => SizedBox(
        height: 220,
        child: ClipRRect(
          borderRadius: BorderRadius.circular(18),
          child: Stack(
            children: [
              FlutterMap(
                mapController: _mapCtrl,
                options: MapOptions(
                  initialCenter: _location,
                  initialZoom: 15,
                  onTap: (_, p) => setState(() {
                    _location = p;
                    _locationPicked = true;
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
                      width: 44,
                      height: 44,
                      child: const Icon(Icons.location_on_rounded,
                          color: Color(0xFFFB923C), size: 40),
                    ),
                  ]),
                ],
              ),
              if (!_locationPicked)
                Positioned(
                  left: 12,
                  right: 12,
                  bottom: 12,
                  child: Container(
                    padding: const EdgeInsets.symmetric(
                        horizontal: 12, vertical: 8),
                    decoration: BoxDecoration(
                      color: Colors.black.withValues(alpha: 0.55),
                      borderRadius: BorderRadius.circular(10),
                    ),
                    child: Text(
                      'Tap on the map to drop a pin at the new location',
                      style: GoogleFonts.inter(
                          color: Colors.white, fontSize: 12),
                      textAlign: TextAlign.center,
                    ),
                  ),
                ),
            ],
          ),
        ),
      );

  Widget _locationActions() => Wrap(
        spacing: 8,
        runSpacing: 8,
        children: [
          if (_serviceDisabled)
            _ghostBtn('Location settings', Geolocator.openLocationSettings),
          if (_permDeniedForever)
            _ghostBtn('App settings', Geolocator.openAppSettings),
          _ghostBtn(
            _locationBusy ? 'Locating…' : 'Use my current location',
            _locationBusy ? null : _fetchLocation,
            icon: Icons.my_location_rounded,
          ),
        ],
      );

  Widget _ghostBtn(String label, VoidCallback? onTap, {IconData? icon}) =>
      OutlinedButton.icon(
        onPressed: onTap,
        icon: Icon(icon ?? Icons.open_in_new_rounded, size: 16),
        label: Text(label,
            style: GoogleFonts.inter(
                fontWeight: FontWeight.w600, fontSize: 12)),
        style: OutlinedButton.styleFrom(
          foregroundColor: Colors.white,
          side: const BorderSide(color: kBorder),
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
          shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(999)),
        ),
      );

  Widget _label(String text) => Text(
        text,
        style: GoogleFonts.inter(
            color: kMuted,
            fontSize: 10,
            fontWeight: FontWeight.w700,
            letterSpacing: 1.4),
      );

  Widget _field({
    required TextEditingController controller,
    required String hint,
    int maxLines = 1,
    TextInputType? keyboardType,
    String? Function(String?)? validator,
  }) =>
      TextFormField(
        controller: controller,
        maxLines: maxLines,
        keyboardType: keyboardType,
        validator: validator,
        style: GoogleFonts.inter(color: Colors.white, fontSize: 14),
        decoration: InputDecoration(
          hintText: hint,
          hintStyle: GoogleFonts.inter(color: kMuted, fontSize: 13),
          filled: true,
          fillColor: kSurface,
          contentPadding:
              const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
          border: OutlineInputBorder(
            borderRadius: BorderRadius.circular(14),
            borderSide: const BorderSide(color: kBorder),
          ),
          enabledBorder: OutlineInputBorder(
            borderRadius: BorderRadius.circular(14),
            borderSide: const BorderSide(color: kBorder),
          ),
          focusedBorder: OutlineInputBorder(
            borderRadius: BorderRadius.circular(14),
            borderSide: const BorderSide(color: kPrimary, width: 1.4),
          ),
          errorStyle: GoogleFonts.inter(
              color: const Color(0xFFFCA5A5), fontSize: 11),
        ),
      );

  // ── Logic ─────────────────────────────────────────────────────────────────

  Future<void> _fetchLocation() async {
    setState(() {
      _locationBusy = true;
      _locationError = null;
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
            'Location permission permanently denied. Enable it from app settings.');
      }
      if (perm == LocationPermission.denied) {
        throw Exception('Location permission denied.');
      }
      final pos = await Geolocator.getCurrentPosition(
          locationSettings:
              const LocationSettings(accuracy: LocationAccuracy.high));
      final p = LatLng(pos.latitude, pos.longitude);
      setState(() {
        _location = p;
        _locationPicked = true;
      });
      _mapCtrl.move(p, 16);
    } catch (e) {
      setState(() => _locationError = e.toString().replaceFirst('Exception: ', ''));
    } finally {
      if (mounted) setState(() => _locationBusy = false);
    }
  }

  Future<void> _submit() async {
    if (_mode == 'new_address' && !_locationPicked) {
      setState(() => _locationError =
          'Please drop a pin or use your current location.');
      return;
    }
    if (!(_formKey.currentState?.validate() ?? false)) return;

    setState(() => _submitting = true);
    try {
      final appState = AppStateScope.of(context);
      final note = _mode == 'new_address'
          ? 'Shift to NEW ADDRESS\n'
              'Address: ${_addrCtrl.text.trim()}\n'
              'Pincode: ${_pinCtrl.text.trim()}\n'
              'Landmark: ${_landmarkCtrl.text.trim().isEmpty ? "—" : _landmarkCtrl.text.trim()}\n'
              'GPS: ${_location.latitude.toStringAsFixed(6)}, ${_location.longitude.toStringAsFixed(6)}\n'
              'Notes: ${_notesCtrl.text.trim().isEmpty ? "—" : _notesCtrl.text.trim()}'
          : 'Shift within SAME ADDRESS\n'
              'Notes: ${_notesCtrl.text.trim().isEmpty ? "—" : _notesCtrl.text.trim()}';

      final ref = await appState.submitServiceRequest(
        type: 'shift',
        note: note,
      );
      if (!mounted) return;
      if (ref == null) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(
            content: Text(appState.error ?? 'Unable to submit request')));
      } else {
        setState(() => _submittedRef = ref);
      }
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }

  Widget _buildSuccess() => Center(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Container(
                width: 84,
                height: 84,
                decoration: BoxDecoration(
                  color: const Color(0xFF10B981).withValues(alpha: 0.18),
                  shape: BoxShape.circle,
                ),
                child: const Icon(Icons.check_circle_rounded,
                    color: Color(0xFF34D399), size: 56),
              ),
              const SizedBox(height: 18),
              Text('Request submitted',
                  style: GoogleFonts.inter(
                      color: Colors.white,
                      fontSize: 20,
                      fontWeight: FontWeight.w800)),
              const SizedBox(height: 6),
              Text(
                'Reference: $_submittedRef',
                style: GoogleFonts.inter(color: kMuted, fontSize: 13),
              ),
              const SizedBox(height: 6),
              Text(
                'Our team will reach out shortly to schedule the shift.',
                textAlign: TextAlign.center,
                style: GoogleFonts.inter(color: kMuted, fontSize: 13),
              ),
              const SizedBox(height: 22),
              SizedBox(
                width: double.infinity,
                child: FilledButton(
                  onPressed: () => Navigator.of(context).pop(),
                  style: FilledButton.styleFrom(
                    backgroundColor: kPrimary,
                    padding:
                        const EdgeInsets.symmetric(vertical: 14),
                    shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(14)),
                  ),
                  child: Text('Done',
                      style: GoogleFonts.inter(
                          fontWeight: FontWeight.w700)),
                ),
              ),
            ],
          ),
        ),
      );
}
