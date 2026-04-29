import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

import '../core/app_state.dart';
import '../core/theme.dart';

class LoginScreen extends StatefulWidget {
  const LoginScreen({super.key});

  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> {
  final _loginCtrl = TextEditingController();
  final _passCtrl = TextEditingController();
  bool _obscure = true;

  @override
  void dispose() {
    _loginCtrl.dispose();
    _passCtrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final appState = InstallerStateScope.of(context);
    final size = MediaQuery.of(context).size;

    return Scaffold(
      backgroundColor: Colors.black,
      body: SafeArea(
          child: SingleChildScrollView(
            padding: const EdgeInsets.symmetric(horizontal: 26),
            child: ConstrainedBox(
              constraints: BoxConstraints(minHeight: size.height - MediaQuery.of(context).padding.top),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const SizedBox(height: 48),

                  // ── Logo ─────────────────────────────────────────
                  Center(
                    child: Image.asset(
                      'assets/images/logo.png',
                      width: 240,
                      fit: BoxFit.contain,
                    ),
                  ),

                  const SizedBox(height: 40),

                  // ── Header ───────────────────────────────────────
                  Row(
                    children: [
                      Container(
                        width: 46,
                        height: 46,
                        decoration: BoxDecoration(
                          borderRadius: BorderRadius.circular(14),
                          gradient: kInstallerGradient,
                        ),
                        child: const Icon(Icons.engineering_rounded,
                            color: Colors.white, size: 24),
                      ),
                      const SizedBox(width: 14),
                      Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            'Field Ops',
                            style: GoogleFonts.inter(
                              color: Colors.white,
                              fontSize: 22,
                              fontWeight: FontWeight.w900,
                              letterSpacing: -0.5,
                            ),
                          ),
                          Text(
                            'JustFiber Installer Portal',
                            style: GoogleFonts.inter(
                                color: kMuted, fontSize: 12),
                          ),
                        ],
                      ),
                    ],
                  ),

                  const SizedBox(height: 10),
                  Text(
                    'Sign in to access jobs, activation\nworkflow, and field diagnostics.',
                    style: GoogleFonts.inter(
                        color: kMuted, fontSize: 13, height: 1.5),
                  ),

                  const SizedBox(height: 32),

                  // ── Phone / ID field ──────────────────────────────
                  _label('Mobile / Employee ID'),
                  const SizedBox(height: 8),
                  Container(
                    decoration: BoxDecoration(
                      color: kSurface,
                      borderRadius: BorderRadius.circular(16),
                      border: Border.all(color: kBorder),
                    ),
                    child: TextField(
                      controller: _loginCtrl,
                      keyboardType: TextInputType.phone,
                      style: GoogleFonts.inter(
                          fontSize: 15, color: Colors.white),
                      decoration: InputDecoration(
                        hintText: '9876543210',
                        hintStyle:
                            GoogleFonts.inter(fontSize: 14, color: kSubtle),
                        prefixIcon: const Icon(Icons.person_outline_rounded,
                            color: kMuted, size: 20),
                        border: InputBorder.none,
                        contentPadding: const EdgeInsets.symmetric(
                            horizontal: 16, vertical: 18),
                      ),
                    ),
                  ),

                  const SizedBox(height: 16),

                  // ── Password field ────────────────────────────────
                  _label('Password'),
                  const SizedBox(height: 8),
                  Container(
                    decoration: BoxDecoration(
                      color: kSurface,
                      borderRadius: BorderRadius.circular(16),
                      border: Border.all(color: kBorder),
                    ),
                    child: TextField(
                      controller: _passCtrl,
                      obscureText: _obscure,
                      style: GoogleFonts.inter(
                          fontSize: 15, color: Colors.white),
                      decoration: InputDecoration(
                        hintText: '••••••••',
                        hintStyle:
                            GoogleFonts.inter(fontSize: 14, color: kSubtle),
                        prefixIcon: const Icon(Icons.lock_outline_rounded,
                            color: kMuted, size: 20),
                        suffixIcon: IconButton(
                          icon: Icon(
                            _obscure
                                ? Icons.visibility_off_outlined
                                : Icons.visibility_outlined,
                            color: kMuted,
                            size: 20,
                          ),
                          onPressed: () =>
                              setState(() => _obscure = !_obscure),
                        ),
                        border: InputBorder.none,
                        contentPadding: const EdgeInsets.symmetric(
                            horizontal: 16, vertical: 18),
                      ),
                      onSubmitted: (_) => appState.busy
                          ? null
                          : appState.login(_loginCtrl.text, _passCtrl.text),
                    ),
                  ),

                  const SizedBox(height: 28),

                  // ── Sign in button ────────────────────────────────
                  GestureDetector(
                    onTap: appState.busy
                        ? null
                        : () =>
                            appState.login(_loginCtrl.text, _passCtrl.text),
                    child: AnimatedContainer(
                      duration: const Duration(milliseconds: 200),
                      width: double.infinity,
                      height: 56,
                      decoration: BoxDecoration(
                        gradient: appState.busy
                            ? LinearGradient(colors: [
                                kPrimary.withValues(alpha: 0.4),
                                kPrimary.withValues(alpha: 0.4),
                              ])
                            : kInstallerGradient,
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
                                    color: Colors.white),
                              )
                            : Row(
                                mainAxisSize: MainAxisSize.min,
                                children: [
                                  Text(
                                    'Sign In',
                                    style: GoogleFonts.inter(
                                      fontSize: 16,
                                      fontWeight: FontWeight.w700,
                                      color: Colors.white,
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

                  // ── Error ─────────────────────────────────────────
                  if ((appState.error ?? '').isNotEmpty) ...[
                    const SizedBox(height: 16),
                    Container(
                      padding: const EdgeInsets.all(14),
                      decoration: BoxDecoration(
                        color: const Color(0x0DFF6B6B),
                        borderRadius: BorderRadius.circular(14),
                        border:
                            Border.all(color: const Color(0x33FF6B6B)),
                      ),
                      child: Row(
                        children: [
                          const Icon(Icons.error_outline_rounded,
                              color: Color(0xFFFF6B6B), size: 16),
                          const SizedBox(width: 10),
                          Expanded(
                            child: Text(
                              appState.error!,
                              style: GoogleFonts.inter(
                                  fontSize: 13,
                                  color: const Color(0xFFFF6B6B)),
                            ),
                          ),
                        ],
                      ),
                    ),
                  ],

                  const SizedBox(height: 48),

                  // ── Security footer ───────────────────────────────
                  Center(
                    child: Row(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        const Icon(Icons.shield_outlined,
                            size: 13, color: kSubtle),
                        const SizedBox(width: 6),
                        Text(
                          'Secured · JustFiber Field Operations',
                          style: GoogleFonts.inter(
                              fontSize: 11, color: kSubtle),
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
    );
  }


  Widget _label(String text) => Text(
        text,
        style: GoogleFonts.inter(
            color: kMuted,
            fontSize: 11,
            fontWeight: FontWeight.w700,
            letterSpacing: 1.1),
      );
}
