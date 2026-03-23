import 'dart:async';

import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

import 'auth_gate.dart';

class SplashScreen extends StatefulWidget {
  const SplashScreen({super.key});

  @override
  State<SplashScreen> createState() => _SplashScreenState();
}

class _SplashScreenState extends State<SplashScreen> with SingleTickerProviderStateMixin {
  late final AnimationController _controller;
  late final Animation<double> _logoScale;
  late final Animation<double> _logoFade;
  late final Animation<double> _orbScale;
  late final Animation<double> _orbGlow;
  Timer? _timer;

  @override
  void initState() {
    super.initState();
    _controller = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 900),
    );
    _logoScale = CurvedAnimation(parent: _controller, curve: Curves.easeOutBack);
    _logoFade = CurvedAnimation(parent: _controller, curve: Curves.easeOut);
    _orbScale = Tween<double>(begin: 0.86, end: 1.0).animate(
      CurvedAnimation(parent: _controller, curve: Curves.easeOutCubic),
    );
    _orbGlow = Tween<double>(begin: 0.35, end: 1.0).animate(
      CurvedAnimation(parent: _controller, curve: Curves.easeOut),
    );
    _controller.forward();
    _timer = Timer(const Duration(milliseconds: 1700), () {
      if (!mounted) return;
      Navigator.of(context).pushReplacement(
        PageRouteBuilder(
          transitionDuration: const Duration(milliseconds: 420),
          pageBuilder: (_, __, ___) => const AuthGate(),
          transitionsBuilder: (_, animation, __, child) {
            return FadeTransition(opacity: animation, child: child);
          },
        ),
      );
    });
  }

  @override
  void dispose() {
    _timer?.cancel();
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.black,
      body: AnimatedBuilder(
        animation: _controller,
        builder: (context, _) {
          return Container(
            decoration: const BoxDecoration(
              gradient: LinearGradient(
                colors: [Color(0xFF020202), Color(0xFF05070B), Color(0xFF020202)],
                begin: Alignment.topCenter,
                end: Alignment.bottomCenter,
              ),
            ),
            child: Stack(
              children: [
                const Positioned.fill(
                  child: DecoratedBox(
                    decoration: BoxDecoration(
                      gradient: RadialGradient(
                        center: Alignment(0, -0.2),
                        radius: 0.72,
                        colors: [Color(0x220E1320), Color(0x00000000)],
                      ),
                    ),
                  ),
                ),
                Positioned(
                  top: 110,
                  left: 0,
                  right: 0,
                  child: Center(
                    child: Opacity(
                      opacity: _orbGlow.value,
                      child: ScaleTransition(
                        scale: _orbScale,
                        child: const _SplashOrb(),
                      ),
                    ),
                  ),
                ),
                Positioned(
                  left: -40,
                  right: -40,
                  bottom: -20,
                  child: Opacity(
                    opacity: _orbGlow.value,
                    child: const _BottomGlow(),
                  ),
                ),
                Center(
                  child: FadeTransition(
                    opacity: _logoFade,
                    child: ScaleTransition(
                      scale: _logoScale,
                      child: Column(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          const SizedBox(height: 150),
                          const _JustFiberBrandMark(),
                          const SizedBox(height: 22),
                          const _JustFiberWordmark(),
                          const SizedBox(height: 12),
                          Text(
                            'CUSTOMER CONSOLE',
                            style: GoogleFonts.dmSans(
                              color: const Color(0x88EFEEE8),
                              fontSize: 11,
                              fontWeight: FontWeight.w700,
                              letterSpacing: 4.2,
                            ),
                          ),
                          const SizedBox(height: 28),
                          Text(
                            'Broadband access,\nbilling, and support.',
                            textAlign: TextAlign.center,
                            style: GoogleFonts.spaceGrotesk(
                              color: const Color(0xFFEFEEE8),
                              fontSize: 34,
                              fontWeight: FontWeight.w700,
                              height: 1.05,
                              letterSpacing: -1.3,
                            ),
                          ),
                          const SizedBox(height: 16),
                          Text(
                            'Live connection status in one sharp customer app.',
                            textAlign: TextAlign.center,
                            style: GoogleFonts.dmSans(
                              color: const Color(0xFF9CA3AF),
                              fontSize: 15,
                              height: 1.45,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                ),
              ],
            ),
          );
        },
      ),
    );
  }
}

class _SplashOrb extends StatelessWidget {
  const _SplashOrb();

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: 240,
      height: 240,
      child: Stack(
        alignment: Alignment.center,
        children: [
          Container(
            width: 210,
            height: 210,
            decoration: const BoxDecoration(
              shape: BoxShape.circle,
              gradient: RadialGradient(
                colors: [Color(0x33E6FF3C), Color(0x00000000)],
              ),
            ),
          ),
          Container(
            width: 152,
            height: 182,
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(999),
              border: Border.all(color: const Color(0x99E6FF3C), width: 2),
              boxShadow: const [
                BoxShadow(color: Color(0x55E6FF3C), blurRadius: 30, spreadRadius: 4),
              ],
            ),
          ),
          Transform.rotate(
            angle: 0.54,
            child: Container(
              width: 108,
              height: 168,
              decoration: BoxDecoration(
                borderRadius: BorderRadius.circular(999),
                border: Border.all(color: const Color(0x66EFF7C1), width: 1.4),
              ),
            ),
          ),
          Transform.rotate(
            angle: -0.56,
            child: Container(
              width: 116,
              height: 156,
              decoration: BoxDecoration(
                borderRadius: BorderRadius.circular(999),
                border: Border.all(color: const Color(0x55E6FF3C), width: 1.6),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _BottomGlow extends StatelessWidget {
  const _BottomGlow();

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      height: 240,
      child: DecoratedBox(
        decoration: const BoxDecoration(
          gradient: RadialGradient(
            center: Alignment(0, 0.95),
            radius: 0.95,
            colors: [
              Color(0xAAE6FF3C),
              Color(0x44B4D82B),
              Color(0x120B0F19),
              Color(0x00000000),
            ],
          ),
        ),
      ),
    );
  }
}

class _JustFiberBrandMark extends StatelessWidget {
  const _JustFiberBrandMark();

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: 136,
      height: 136,
      child: Stack(
        alignment: Alignment.center,
        children: [
          Container(
            width: 132,
            height: 132,
            decoration: const BoxDecoration(
              shape: BoxShape.circle,
              gradient: RadialGradient(
                colors: [Color(0x33E6FF3C), Color(0x00000000)],
              ),
            ),
          ),
          Transform.rotate(
            angle: 0.34,
            child: Container(
              width: 34,
              height: 96,
              decoration: BoxDecoration(
                color: const Color(0xFFFFFFFF),
                borderRadius: BorderRadius.circular(12),
              ),
            ),
          ),
          Transform.translate(
            offset: const Offset(-28, 8),
            child: Transform.rotate(
              angle: 0.34,
              child: Container(
                width: 34,
                height: 96,
                decoration: BoxDecoration(
                  color: const Color(0xFFE6FF3C),
                  borderRadius: BorderRadius.circular(12),
                ),
              ),
            ),
          ),
          Transform.translate(
            offset: const Offset(-4, 40),
            child: Transform.rotate(
              angle: 0.34,
              child: Container(
                width: 34,
                height: 96,
                decoration: BoxDecoration(
                  color: const Color(0xFFE6FF3C),
                  borderRadius: BorderRadius.circular(12),
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _JustFiberWordmark extends StatelessWidget {
  const _JustFiberWordmark();

  @override
  Widget build(BuildContext context) {
    return RichText(
      text: const TextSpan(
        style: TextStyle(
          fontSize: 40,
          fontWeight: FontWeight.w800,
          letterSpacing: -1.2,
        ),
        children: [
          TextSpan(text: 'Just', style: TextStyle(color: const Color(0xFFEFEEE8))),
          TextSpan(text: 'Fiber', style: TextStyle(color: Color(0xFFE6FF3C))),
        ],
      ),
    );
  }
}
