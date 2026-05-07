import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:google_fonts/google_fonts.dart';

import '../core/app_state.dart';
import '../core/theme.dart';

/// Lightweight booking-interest enquiry. Captures contact details and
/// plan/notes interest and submits to the lead pipeline. Customer is told
/// the sales team will follow up via call.
class BookingEnquiryScreen extends StatefulWidget {
  const BookingEnquiryScreen({super.key, this.initialMobile, this.initialName});

  final String? initialMobile;
  final String? initialName;

  @override
  State<BookingEnquiryScreen> createState() => _BookingEnquiryScreenState();
}

class _BookingEnquiryScreenState extends State<BookingEnquiryScreen> {
  final _formKey = GlobalKey<FormState>();
  late final TextEditingController _nameCtrl;
  late final TextEditingController _mobileCtrl;
  final _emailCtrl = TextEditingController();
  final _addressCtrl = TextEditingController();
  final _pinCtrl = TextEditingController();
  final _planCtrl = TextEditingController();
  final _notesCtrl = TextEditingController();
  bool _submitting = false;
  String? _leadNumber;
  String? _error;

  @override
  void initState() {
    super.initState();
    _nameCtrl = TextEditingController(text: widget.initialName ?? '');
    _mobileCtrl = TextEditingController(text: widget.initialMobile ?? '');
  }

  @override
  void dispose() {
    _nameCtrl.dispose();
    _mobileCtrl.dispose();
    _emailCtrl.dispose();
    _addressCtrl.dispose();
    _pinCtrl.dispose();
    _planCtrl.dispose();
    _notesCtrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final appState = AppStateScope.of(context);
    return Scaffold(
      backgroundColor: kBg,
      appBar: AppBar(
        backgroundColor: kBg,
        elevation: 0,
        scrolledUnderElevation: 0,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_rounded, color: Colors.white),
          onPressed: () => Navigator.of(context).pop(),
        ),
        title: Text(
          'Booking Enquiry',
          style: GoogleFonts.inter(
            color: Colors.white,
            fontWeight: FontWeight.w800,
            fontSize: 17,
          ),
        ),
      ),
      body: _leadNumber != null
          ? _SuccessView(leadNumber: _leadNumber!, onClose: () => Navigator.of(context).pop())
          : _buildForm(appState),
    );
  }

  Widget _buildForm(AppState appState) {
    return Form(
      key: _formKey,
      child: ListView(
        padding: const EdgeInsets.fromLTRB(18, 8, 18, 36),
        children: [
          // Hero
          Container(
            padding: const EdgeInsets.all(20),
            decoration: BoxDecoration(
              gradient: const LinearGradient(
                colors: [Color(0xFF8224E3), Color(0xFF6D28D9)],
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
              ),
              borderRadius: BorderRadius.circular(22),
              border: Border.all(color: const Color(0x55D8B4FE)),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
                  decoration: BoxDecoration(
                    color: Colors.white.withValues(alpha: 0.18),
                    borderRadius: BorderRadius.circular(999),
                  ),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      const Icon(Icons.support_agent_rounded,
                          color: Colors.white, size: 12),
                      const SizedBox(width: 4),
                      Text('We\'ll call within 30 min',
                          style: GoogleFonts.inter(
                              color: Colors.white,
                              fontSize: 11,
                              fontWeight: FontWeight.w700)),
                    ],
                  ),
                ),
                const SizedBox(height: 14),
                Text(
                  'Book your\nfiber connection',
                  style: GoogleFonts.inter(
                    color: Colors.white,
                    fontSize: 24,
                    fontWeight: FontWeight.w900,
                    height: 1.15,
                    letterSpacing: -0.5,
                  ),
                ),
                const SizedBox(height: 6),
                Text(
                  'Share your details — our team will recommend the best plan and get you connected fast.',
                  style: GoogleFonts.inter(
                    color: Colors.white70,
                    fontSize: 13,
                    height: 1.4,
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 22),

          const _SectionLabel('YOUR DETAILS'),
          const SizedBox(height: 10),
          _field(
            controller: _nameCtrl,
            label: 'Full Name',
            icon: Icons.person_outline_rounded,
            validator: (v) => (v == null || v.trim().isEmpty) ? 'Required' : null,
          ),
          const SizedBox(height: 12),
          _field(
            controller: _mobileCtrl,
            label: 'Mobile Number',
            icon: Icons.phone_rounded,
            keyboard: TextInputType.phone,
            inputFormatters: [
              FilteringTextInputFormatter.digitsOnly,
              LengthLimitingTextInputFormatter(10),
            ],
            validator: (v) {
              final t = (v ?? '').trim();
              if (t.length != 10) return 'Enter 10-digit mobile';
              return null;
            },
          ),
          const SizedBox(height: 12),
          _field(
            controller: _emailCtrl,
            label: 'Email (optional)',
            icon: Icons.email_outlined,
            keyboard: TextInputType.emailAddress,
          ),

          const SizedBox(height: 22),
          const _SectionLabel('INSTALLATION ADDRESS'),
          const SizedBox(height: 10),
          _field(
            controller: _addressCtrl,
            label: 'Full Address',
            icon: Icons.location_on_outlined,
            maxLines: 2,
            validator: (v) => (v == null || v.trim().isEmpty) ? 'Required' : null,
          ),
          const SizedBox(height: 12),
          _field(
            controller: _pinCtrl,
            label: 'Pincode',
            icon: Icons.pin_drop_outlined,
            keyboard: TextInputType.number,
            inputFormatters: [
              FilteringTextInputFormatter.digitsOnly,
              LengthLimitingTextInputFormatter(6),
            ],
            validator: (v) {
              final t = (v ?? '').trim();
              if (t.length != 6) return 'Enter 6-digit pincode';
              return null;
            },
          ),

          const SizedBox(height: 22),
          const _SectionLabel('PLAN & NOTES'),
          const SizedBox(height: 10),
          _field(
            controller: _planCtrl,
            label: 'Plan you\'re interested in (optional)',
            icon: Icons.wifi_rounded,
            hint: 'e.g. 200 Mbps unlimited',
          ),
          const SizedBox(height: 12),
          _field(
            controller: _notesCtrl,
            label: 'Anything else? (optional)',
            icon: Icons.edit_note_rounded,
            maxLines: 3,
            hint: 'Best time to call, special needs, etc.',
          ),

          if (_error != null) ...[
            const SizedBox(height: 14),
            Container(
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: const Color(0x22FF6B6B),
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: const Color(0x55FF6B6B)),
              ),
              child: Row(
                children: [
                  const Icon(Icons.error_outline,
                      color: Color(0xFFFF6B6B), size: 18),
                  const SizedBox(width: 8),
                  Expanded(
                    child: Text(
                      _error!,
                      style: GoogleFonts.inter(
                          color: const Color(0xFFFF6B6B),
                          fontSize: 12,
                          fontWeight: FontWeight.w600),
                    ),
                  ),
                ],
              ),
            ),
          ],

          const SizedBox(height: 26),
          SizedBox(
            width: double.infinity,
            child: FilledButton.icon(
              onPressed: _submitting ? null : () => _submit(appState),
              icon: _submitting
                  ? const SizedBox(
                      width: 18,
                      height: 18,
                      child: CircularProgressIndicator(
                          color: Colors.white, strokeWidth: 2.2),
                    )
                  : const Icon(Icons.send_rounded, size: 18),
              label: Text(
                _submitting ? 'Submitting...' : 'Submit Enquiry',
                style: GoogleFonts.inter(
                    fontWeight: FontWeight.w800, fontSize: 14),
              ),
              style: FilledButton.styleFrom(
                backgroundColor: kPrimary,
                foregroundColor: Colors.white,
                padding: const EdgeInsets.symmetric(vertical: 16),
                shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(16)),
              ),
            ),
          ),
          const SizedBox(height: 16),
          Center(
            child: Text(
              'By submitting, you agree to be contacted by our sales team.',
              style: GoogleFonts.inter(color: kMuted, fontSize: 11),
              textAlign: TextAlign.center,
            ),
          ),
        ],
      ),
    );
  }

  Widget _field({
    required TextEditingController controller,
    required String label,
    IconData? icon,
    String? hint,
    int maxLines = 1,
    TextInputType? keyboard,
    List<TextInputFormatter>? inputFormatters,
    String? Function(String?)? validator,
  }) {
    return TextFormField(
      controller: controller,
      keyboardType: keyboard,
      inputFormatters: inputFormatters,
      maxLines: maxLines,
      validator: validator,
      style: GoogleFonts.inter(color: Colors.white, fontSize: 14),
      decoration: InputDecoration(
        labelText: label,
        hintText: hint,
        labelStyle: GoogleFonts.inter(color: kMuted, fontSize: 13),
        hintStyle: GoogleFonts.inter(color: Colors.white24, fontSize: 12),
        prefixIcon: icon != null ? Icon(icon, size: 18, color: kMuted) : null,
        filled: true,
        fillColor: kSurface2,
        contentPadding:
            const EdgeInsets.symmetric(horizontal: 14, vertical: 14),
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
          borderSide: BorderSide(color: kPrimary.withValues(alpha: 0.6)),
        ),
        errorBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(14),
          borderSide: const BorderSide(color: Color(0xFFFF6B6B)),
        ),
        focusedErrorBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(14),
          borderSide: const BorderSide(color: Color(0xFFFF6B6B)),
        ),
      ),
    );
  }

  Future<void> _submit(AppState appState) async {
    if (!(_formKey.currentState?.validate() ?? false)) return;
    setState(() {
      _submitting = true;
      _error = null;
    });
    try {
      final notes = _notesCtrl.text.trim();
      final planText = _planCtrl.text.trim();
      final addr = _addressCtrl.text.trim();
      final composedAddress = notes.isNotEmpty
          ? '$addr\n\nNotes: $notes'
          : addr;
      final lead = await appState.submitConnectionLead(
        fullName: _nameCtrl.text.trim(),
        mobile: _mobileCtrl.text.trim(),
        email: _emailCtrl.text.trim().isEmpty ? null : _emailCtrl.text.trim(),
        address: composedAddress,
        pinCode: _pinCtrl.text.trim(),
        lat: 0.0,
        lng: 0.0,
        planName: planText.isEmpty ? null : planText,
      );
      if (!mounted) return;
      setState(() {
        _submitting = false;
        _leadNumber = lead ?? 'ENQ-${DateTime.now().millisecondsSinceEpoch}';
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _submitting = false;
        _error = e.toString().replaceFirst('Exception: ', '');
      });
    }
  }
}

class _SectionLabel extends StatelessWidget {
  const _SectionLabel(this.text);
  final String text;
  @override
  Widget build(BuildContext context) {
    return Text(
      text,
      style: GoogleFonts.inter(
        color: kMuted,
        fontSize: 11,
        fontWeight: FontWeight.w700,
        letterSpacing: 1.1,
      ),
    );
  }
}

class _SuccessView extends StatelessWidget {
  const _SuccessView({required this.leadNumber, required this.onClose});
  final String leadNumber;
  final VoidCallback onClose;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.all(24),
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Container(
            width: 96,
            height: 96,
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              gradient: const LinearGradient(
                colors: [Color(0xFF4ADE80), Color(0xFF16A34A)],
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
              ),
              boxShadow: [
                BoxShadow(
                  color: const Color(0xFF4ADE80).withValues(alpha: 0.45),
                  blurRadius: 24,
                  offset: const Offset(0, 6),
                ),
              ],
            ),
            child: const Icon(Icons.check_rounded,
                color: Colors.white, size: 48),
          ),
          const SizedBox(height: 22),
          Text(
            'Enquiry Submitted!',
            style: GoogleFonts.inter(
              color: Colors.white,
              fontSize: 22,
              fontWeight: FontWeight.w900,
              letterSpacing: -0.4,
            ),
          ),
          const SizedBox(height: 8),
          Text(
            'Our sales team will call you on the registered mobile within 30 minutes.',
            textAlign: TextAlign.center,
            style: GoogleFonts.inter(
              color: Colors.white70,
              fontSize: 13,
              height: 1.5,
            ),
          ),
          const SizedBox(height: 22),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 12),
            decoration: BoxDecoration(
              color: kSurface2,
              borderRadius: BorderRadius.circular(14),
              border: Border.all(color: kBorder),
            ),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                const Icon(Icons.confirmation_num_outlined,
                    color: Colors.white70, size: 16),
                const SizedBox(width: 8),
                Text(
                  'Reference: ',
                  style: GoogleFonts.inter(color: kMuted, fontSize: 12),
                ),
                Text(
                  leadNumber,
                  style: GoogleFonts.inter(
                    color: Colors.white,
                    fontSize: 13,
                    fontWeight: FontWeight.w800,
                    letterSpacing: 0.4,
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 32),
          SizedBox(
            width: double.infinity,
            child: FilledButton(
              onPressed: onClose,
              style: FilledButton.styleFrom(
                backgroundColor: kPrimary,
                foregroundColor: Colors.white,
                padding: const EdgeInsets.symmetric(vertical: 16),
                shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(16)),
              ),
              child: Text(
                'Done',
                style: GoogleFonts.inter(
                    fontWeight: FontWeight.w800, fontSize: 14),
              ),
            ),
          ),
        ],
      ),
    );
  }
}
