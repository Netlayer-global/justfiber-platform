import 'dart:async';

import 'package:flutter/material.dart';

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
      body: Center(
        child: FadeTransition(
          opacity: _logoFade,
          child: ScaleTransition(
            scale: _logoScale,
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: const [
                _JustFiberBrandMark(),
                SizedBox(height: 22),
                _JustFiberWordmark(),
              ],
            ),
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
                  color: const Color(0xFF39FF14),
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
                  color: const Color(0xFF39FF14),
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
          TextSpan(text: 'Just', style: TextStyle(color: Colors.white)),
          TextSpan(text: 'Fiber', style: TextStyle(color: Color(0xFF39FF14))),
        ],
      ),
    );
  }
}
