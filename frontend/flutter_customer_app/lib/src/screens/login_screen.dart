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
  final _otpFocus = List.generate(6, (_) => FocusNode());
  bool _otpSent = false;

  String get _otp => _otpCtrl.map((c) => c.text).join();

  void _snack(String msg) =>
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(msg)));

  String _friendlyError(String raw) {
    final message = raw.replaceFirst(RegExp(r'^Exception:\s*'), '').trim();
    final lower = message.toLowerCase();
    if (lower.contains('timeout') || lower.contains('took too long')) {
      return 'Server took too long. Please try again.';
    }
    if (lower.contains('clientexception') ||
        lower.contains('failed host lookup') ||
        lower.contains('connection refused') ||
        lower.contains('connection reset')) {
      return 'Unable to connect. Please check internet and try again.';
    }
    return message.isEmpty ? 'Something went wrong. Please try again.' : message;
  }

  @override
  void dispose() {
    _idCtrl.dispose();
    for (final c in _otpCtrl) {
      c.dispose();
    }
    for (final f in _otpFocus) {
      f.dispose();
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
      _snack('OTP sent to +91 $id');
    }
  }

  void _onOtpDigit(int index, String value, AppState state) {
    if (value.isNotEmpty) {
      if (index < 5) {
        _otpFocus[index + 1].requestFocus();
      } else {
        _otpFocus[index].unfocus();
        if (_otp.length == 6) _primary(state);
      }
    }
  }

  void _onOtpBackspace(int index) {
    if (_otpCtrl[index].text.isEmpty && index > 0) {
      _otpCtrl[index - 1].clear();
      _otpFocus[index - 1].requestFocus();
    }
  }

  @override
  Widget build(BuildContext context) {
    final appState = AppStateScope.of(context);
    final size = MediaQuery.of(context).size;
    final top = MediaQuery.of(context).padding.top;

    return Scaffold(
      backgroundColor: Colors.black,
      body: Stack(
        children: [
          // Animated gradient orbs for premium depth
          Positioned(
            top: -80,
            right: -60,
            child: Container(
              width: 250,
              height: 250,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                gradient: RadialGradient(
                  colors: [
                    kPrimary.withValues(alpha: 0.12),
                    Colors.transparent,
                  ],
                ),
              ),
            ),
          ),
          Positioned(
            bottom: -100,
            left: -80,
            child: Container(
              width: 300,
              height: 300,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                gradient: RadialGradient(
                  colors: [
                    kAccentCyan.withValues(alpha: 0.06),
                    Colors.transparent,
                  ],
                ),
              ),
            ),
          ),
          // Main content
          SafeArea(
          child: SingleChildScrollView(
            child: ConstrainedBox(
              constraints: BoxConstraints(minHeight: size.height - top),
              child: Padding(
                padding: const EdgeInsets.symmetric(horizontal: 26),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const SizedBox(height: 36),

                    // ── Logo ────────────────────────────────────────
                    Center(
                      child: Image.asset(
                        'assets/images/logo.png',
                        width: 240,
                        fit: BoxFit.contain,
                      ),
                    ),

                    const SizedBox(height: 44),

                    // ── Title ───────────────────────────────────────
                    AnimatedSwitcher(
                      duration: const Duration(milliseconds: 220),
                      child: Column(
                        key: ValueKey(_otpSent),
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            _otpSent ? 'Enter OTP' : 'Welcome\nback.',
                            style: GoogleFonts.inter(
                              fontSize: 36,
                              fontWeight: FontWeight.w900,
                              color: Colors.white,
                              letterSpacing: -1.2,
                              height: 1.05,
                            ),
                          ),
                          const SizedBox(height: 8),
                          Text(
                            _otpSent
                                ? 'Enter the 6-digit code sent to +91 ${_idCtrl.text.trim()}'
                                : 'Sign in to manage your plan,\nbilling & support.',
                            style: GoogleFonts.inter(
                              fontSize: 14,
                              color: kMuted,
                              height: 1.5,
                            ),
                          ),
                        ],
                      ),
                    ),

                    const SizedBox(height: 32),

                    // ── Mobile field with +91 prefix ─────────────────
                    if (!_otpSent)
                      Container(
                        decoration: BoxDecoration(
                          color: kSurface,
                          borderRadius: BorderRadius.circular(16),
                          border: Border.all(color: kBorder),
                        ),
                        child: Row(
                          children: [
                            Container(
                              padding: const EdgeInsets.symmetric(
                                  horizontal: 14, vertical: 18),
                              decoration: const BoxDecoration(
                                border: Border(
                                    right: BorderSide(color: kBorder)),
                              ),
                              child: Row(
                                children: [
                                  const Text('🇮🇳',
                                      style: TextStyle(fontSize: 18)),
                                  const SizedBox(width: 6),
                                  Text(
                                    '+91',
                                    style: GoogleFonts.inter(
                                      color: Colors.white,
                                      fontWeight: FontWeight.w700,
                                      fontSize: 14,
                                    ),
                                  ),
                                ],
                              ),
                            ),
                            Expanded(
                              child: TextField(
                                controller: _idCtrl,
                                keyboardType: TextInputType.phone,
                                inputFormatters: [
                                  FilteringTextInputFormatter.digitsOnly,
                                  LengthLimitingTextInputFormatter(10),
                                ],
                                style: GoogleFonts.inter(
                                    fontSize: 15, color: Colors.white),
                                decoration: InputDecoration(
                                  hintText: '98765 43210',
                                  hintStyle: GoogleFonts.inter(
                                      fontSize: 14, color: kMuted),
                                  border: InputBorder.none,
                                  contentPadding:
                                      const EdgeInsets.symmetric(
                                          horizontal: 14, vertical: 18),
                                ),
                                onSubmitted: (_) => _primary(appState),
                              ),
                            ),
                          ],
                        ),
                      ),

                    // ── OTP boxes ────────────────────────────────────
                    if (_otpSent) ...[
                      Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: List.generate(6, (i) {
                          return SizedBox(
                            width: (size.width - 52 - 40) / 6,
                            child: KeyboardListener(
                              focusNode: FocusNode(),
                              onKeyEvent: (e) {
                                if (e is KeyDownEvent &&
                                    e.logicalKey ==
                                        LogicalKeyboardKey.backspace) {
                                  _onOtpBackspace(i);
                                }
                              },
                              child: TextField(
                                controller: _otpCtrl[i],
                                focusNode: _otpFocus[i],
                                textAlign: TextAlign.center,
                                keyboardType: TextInputType.number,
                                inputFormatters: [
                                  FilteringTextInputFormatter.digitsOnly,
                                  LengthLimitingTextInputFormatter(1),
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
                                  fillColor: kSurface,
                                  contentPadding:
                                      const EdgeInsets.symmetric(vertical: 16),
                                  border: OutlineInputBorder(
                                    borderRadius: BorderRadius.circular(14),
                                    borderSide:
                                        const BorderSide(color: kBorder),
                                  ),
                                  enabledBorder: OutlineInputBorder(
                                    borderRadius: BorderRadius.circular(14),
                                    borderSide:
                                        const BorderSide(color: kBorder),
                                  ),
                                  focusedBorder: OutlineInputBorder(
                                    borderRadius: BorderRadius.circular(14),
                                    borderSide: const BorderSide(
                                        color: kPrimary, width: 1.8),
                                  ),
                                ),
                                onChanged: (v) =>
                                    _onOtpDigit(i, v, appState),
                              ),
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
                                    size: 13, color: kMuted),
                                const SizedBox(width: 4),
                                Text('Change number',
                                    style: GoogleFonts.inter(
                                        fontSize: 13, color: kMuted)),
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

                    const SizedBox(height: 24),

                    // ── CTA button ───────────────────────────────────
                    GestureDetector(
                      onTap: appState.busy ? null : () => _primary(appState),
                      child: AnimatedContainer(
                        duration: const Duration(milliseconds: 200),
                        width: double.infinity,
                        height: 58,
                        decoration: BoxDecoration(
                          gradient: appState.busy
                              ? LinearGradient(colors: [
                                  kPrimary.withValues(alpha: 0.4),
                                  kPrimary.withValues(alpha: 0.4),
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
                                    color: kPrimary.withValues(alpha: 0.4),
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
                              : Row(
                                  mainAxisSize: MainAxisSize.min,
                                  children: [
                                    Text(
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
                                    const SizedBox(width: 8),
                                    const Icon(Icons.arrow_forward_rounded,
                                        color: Colors.white, size: 18),
                                  ],
                                ),
                        ),
                      ),
                    ),

                    // ── Demo OTP banner ──────────────────────────────
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

                    // ── Error banner ─────────────────────────────────
                    if ((appState.error ?? '').isNotEmpty) ...[
                      const SizedBox(height: 12),
                      _Banner(
                        icon: Icons.error_outline_rounded,
                        color: const Color(0xFFFF6B6B),
                        bg: const Color(0x0DFF6B6B),
                        border: const Color(0x33FF6B6B),
                        text: _friendlyError(appState.error!),
                      ),
                    ],

                    const SizedBox(height: 48),

                    // ── Footer ───────────────────────────────────────
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
        ],
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
