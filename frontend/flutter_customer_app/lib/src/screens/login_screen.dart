import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:google_fonts/google_fonts.dart';

import '../core/app_state.dart';
import '../core/theme.dart';

class LoginScreen extends StatefulWidget {
  const LoginScreen({super.key});

  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> {
  final _idCtrl = TextEditingController();
  final _otpCtrl = List.generate(6, (_) => TextEditingController());
  bool _otpSent = false;

  String get _otp => _otpCtrl.map((c) => c.text).join();

  void _snack(String msg) =>
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(msg)));

  @override
  void dispose() {
    _idCtrl.dispose();
    for (final c in _otpCtrl) {
      c.dispose();
    }
    super.dispose();
  }

  Future<void> _primary(AppState state) async {
    final id = _idCtrl.text.trim();
    if (id.isEmpty) {
      _snack('Enter your mobile number.');
      return;
    }
    if (_otp.length == 6) {
      final ok = await state.verifyOtp(id, _otp);
      if (!mounted) return;
      if (!ok) setState(() => _otpSent = true);
      return;
    }
    await state.requestOtp(id);
    if (!mounted) return;
    if ((state.error ?? '').isEmpty) {
      setState(() => _otpSent = true);
      _snack('OTP sent successfully.');
    }
  }

  @override
  Widget build(BuildContext context) {
    final appState = AppStateScope.of(context);
    final size = MediaQuery.of(context).size;
    final top = MediaQuery.of(context).padding.top;

    return Scaffold(
      backgroundColor: Colors.black,
      body: SafeArea(
            child: SingleChildScrollView(
              child: ConstrainedBox(
                constraints: BoxConstraints(minHeight: size.height - top),
                child: Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 26),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const SizedBox(height: 48),

                      // ── Logo block ────────────────────────────────────
                      Center(
                        child: Image.asset(
                          'assets/images/logo.png',
                          width: 260,
                          fit: BoxFit.contain,
                        ),
                      ),

                      const SizedBox(height: 52),

                      // ── Title ─────────────────────────────────────────
                      Text(
                        _otpSent ? 'Enter OTP' : 'Welcome\nback.',
                        style: GoogleFonts.inter(
                          fontSize: 38,
                          fontWeight: FontWeight.w900,
                          color: Colors.white,
                          letterSpacing: -1.2,
                          height: 1.05,
                        ),
                      ),
                      const SizedBox(height: 10),
                      Text(
                        _otpSent
                            ? 'Enter the 6-digit code sent to your number.'
                            : 'Sign in to manage your plan,\nbilling & support.',
                        style: GoogleFonts.inter(
                          fontSize: 14,
                          color: const Color(0xFF666680),
                          height: 1.5,
                        ),
                      ),

                      const SizedBox(height: 36),

                      // ── Mobile / ID field ─────────────────────────────
                      if (!_otpSent)
                        _Field(
                          controller: _idCtrl,
                          label: 'Mobile Number',
                          hint: '9876543210',
                          icon: Icons.person_outline_rounded,
                          keyboardType: TextInputType.phone,
                        ),

                      // ── OTP boxes ─────────────────────────────────────
                      if (_otpSent) ...[
                        Row(
                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                          children: List.generate(6, (i) {
                            return SizedBox(
                              width: (MediaQuery.of(context).size.width - 52 - 40) / 6,
                              child: TextField(
                                controller: _otpCtrl[i],
                                textAlign: TextAlign.center,
                                keyboardType: TextInputType.number,
                                inputFormatters: [
                                  LengthLimitingTextInputFormatter(1)
                                ],
                                maxLength: 1,
                                style: GoogleFonts.inter(
                                  fontSize: 22,
                                  fontWeight: FontWeight.w800,
                                  color: Colors.white,
                                ),
                                decoration: InputDecoration(
                                  counterText: '',
                                  filled: true,
                                  fillColor: const Color(0xFF111111),
                                  contentPadding:
                                      const EdgeInsets.symmetric(vertical: 16),
                                  border: OutlineInputBorder(
                                    borderRadius: BorderRadius.circular(14),
                                    borderSide: const BorderSide(
                                        color: Color(0xFF222222)),
                                  ),
                                  enabledBorder: OutlineInputBorder(
                                    borderRadius: BorderRadius.circular(14),
                                    borderSide: const BorderSide(
                                        color: Color(0xFF222222)),
                                  ),
                                  focusedBorder: OutlineInputBorder(
                                    borderRadius: BorderRadius.circular(14),
                                    borderSide: const BorderSide(
                                        color: kPrimary, width: 1.5),
                                  ),
                                ),
                                onChanged: (v) {
                                  if (v.isNotEmpty && i < 5) {
                                    FocusScope.of(context).nextFocus();
                                  }
                                },
                              ),
                            );
                          }),
                        ),
                        const SizedBox(height: 16),
                        Row(
                          children: [
                            GestureDetector(
                              onTap: () => setState(() {
                                _otpSent = false;
                                for (final c in _otpCtrl) {
                                c.clear();
                              }
                              }),
                              child: Row(
                                children: [
                                  const Icon(Icons.arrow_back_ios_rounded,
                                      size: 13, color: Color(0xFF666680)),
                                  const SizedBox(width: 4),
                                  Text(
                                    'Change number',
                                    style: GoogleFonts.inter(
                                        fontSize: 13,
                                        color: const Color(0xFF666680)),
                                  ),
                                ],
                              ),
                            ),
                            const Spacer(),
                            GestureDetector(
                              onTap: appState.busy
                                  ? null
                                  : () async {
                                      final id = _idCtrl.text.trim();
                                      if (id.isEmpty) return;
                                      await appState.requestOtp(id);
                                      if (!mounted) return;
                                      if ((appState.error ?? '').isEmpty) {
                                        _snack('OTP resent.');
                                      }
                                    },
                              child: Text(
                                'Resend OTP',
                                style: GoogleFonts.inter(
                                  fontSize: 13,
                                  fontWeight: FontWeight.w700,
                                  color: kPrimaryLight,
                                ),
                              ),
                            ),
                          ],
                        ),
                      ],

                      const SizedBox(height: 28),

                      // ── CTA button ────────────────────────────────────
                      GestureDetector(
                        onTap: appState.busy ? null : () => _primary(appState),
                        child: Container(
                          width: double.infinity,
                          height: 58,
                          decoration: BoxDecoration(
                            gradient: appState.busy
                                ? LinearGradient(colors: [
                                    kPrimary.withValues(alpha: 0.45),
                                    kPrimary.withValues(alpha: 0.45),
                                  ])
                                : const LinearGradient(
                                    colors: [
                                      Color(0xFFBB6FF7),
                                      Color(0xFF6D28D9)
                                    ],
                                    begin: Alignment.topLeft,
                                    end: Alignment.bottomRight,
                                  ),
                            borderRadius: BorderRadius.circular(16),
                            boxShadow: appState.busy
                                ? []
                                : [
                                    BoxShadow(
                                      color: kPrimary.withValues(alpha: 0.40),
                                      blurRadius: 20,
                                      offset: const Offset(0, 8),
                                    ),
                                  ],
                          ),
                          child: Center(
                            child: appState.busy
                                ? const SizedBox(
                                    width: 22,
                                    height: 22,
                                    child: CircularProgressIndicator(
                                      strokeWidth: 2.5,
                                      color: Colors.white,
                                    ),
                                  )
                                : Text(
                                    _otpSent
                                        ? 'Verify & Sign In'
                                        : 'Send OTP',
                                    style: GoogleFonts.inter(
                                      fontSize: 16,
                                      fontWeight: FontWeight.w700,
                                      color: Colors.white,
                                      letterSpacing: 0.2,
                                    ),
                                  ),
                          ),
                        ),
                      ),

                      // ── Demo OTP ──────────────────────────────────────
                      if ((appState.demoOtp ?? '').isNotEmpty) ...[
                        const SizedBox(height: 16),
                        _Banner(
                          icon: Icons.info_outline_rounded,
                          color: kPrimaryLight,
                          bg: kPrimary.withValues(alpha: 0.08),
                          border: kPrimary.withValues(alpha: 0.20),
                          text: 'Demo OTP: ${appState.demoOtp}',
                        ),
                      ],

                      // ── Error ─────────────────────────────────────────
                      if ((appState.error ?? '').isNotEmpty) ...[
                        const SizedBox(height: 12),
                        _Banner(
                          icon: Icons.error_outline_rounded,
                          color: const Color(0xFFFF6B6B),
                          bg: const Color(0x0DFF6B6B),
                          border: const Color(0x33FF6B6B),
                          text: (appState.error!.contains('Exception:') || appState.error!.contains('devices:'))
                              ? 'Server took too long. Please try again.'
                              : appState.error!,
                        ),
                      ],

                      const SizedBox(height: 52),

                      // ── Footer ────────────────────────────────────────
                      Center(
                        child: Row(
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            const Icon(Icons.lock_outline_rounded,
                                size: 13, color: Color(0xFF444460)),
                            const SizedBox(width: 6),
                            Text(
                              'End-to-end encrypted · Secured by JustFiber',
                              style: GoogleFonts.inter(
                                  fontSize: 11,
                                  color: const Color(0xFF444460)),
                            ),
                          ],
                        ),
                      ),
                      const SizedBox(height: 24),
                    ],
                  ),
                ),
              ),
            ),
          ),
    );
  }
}

// ── Outlined text field ────────────────────────────────────────────────────────

class _Field extends StatelessWidget {
  const _Field({
    required this.controller,
    required this.label,
    required this.hint,
    required this.icon,
    this.keyboardType = TextInputType.text,
  });

  final TextEditingController controller;
  final String label, hint;
  final IconData icon;
  final TextInputType keyboardType;

  @override
  Widget build(BuildContext context) {
    return TextField(
      controller: controller,
      keyboardType: keyboardType,
      style: GoogleFonts.inter(fontSize: 15, color: Colors.white),
      decoration: InputDecoration(
        labelText: label,
        hintText: hint,
        hintStyle:
            GoogleFonts.inter(fontSize: 13, color: const Color(0xFF444460)),
        labelStyle:
            GoogleFonts.inter(fontSize: 13, color: const Color(0xFF666680)),
        floatingLabelStyle:
            GoogleFonts.inter(fontSize: 11, color: kPrimaryLight),
        prefixIcon: Icon(icon, color: const Color(0xFF666680), size: 20),
        filled: true,
        fillColor: const Color(0xFF111111),
        contentPadding:
            const EdgeInsets.symmetric(horizontal: 16, vertical: 20),
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(16),
          borderSide: const BorderSide(color: Color(0xFF222222)),
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(16),
          borderSide: const BorderSide(color: Color(0xFF222222)),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(16),
          borderSide: const BorderSide(color: kPrimary, width: 1.5),
        ),
      ),
    );
  }
}

// ── Info / error banner ────────────────────────────────────────────────────────

class _Banner extends StatelessWidget {
  const _Banner({
    required this.icon,
    required this.color,
    required this.bg,
    required this.border,
    required this.text,
  });

  final IconData icon;
  final Color color, bg, border;
  final String text;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 13),
      decoration: BoxDecoration(
        color: bg,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: border),
      ),
      child: Row(
        children: [
          Icon(icon, color: color, size: 16),
          const SizedBox(width: 10),
          Expanded(
            child: Text(text,
                style: GoogleFonts.inter(
                    fontSize: 13,
                    color: color,
                    fontWeight: FontWeight.w500)),
          ),
        ],
      ),
    );
  }
}
