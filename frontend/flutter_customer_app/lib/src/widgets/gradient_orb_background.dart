import 'package:flutter/material.dart';

class GradientOrbBackground extends StatelessWidget {
  const GradientOrbBackground({super.key, required this.child});

  final Widget child;

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: const BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [Color(0xFF0C1018), Color(0xFF10141C), Color(0xFF12161A)],
        ),
      ),
      child: Stack(
        children: [
          Positioned(top: -80, right: -30, child: _orb(const Color(0x148224E3), 220)),
          Positioned(top: 240, left: -70, child: _orb(const Color(0x0C8224E3), 180)),
          Positioned(bottom: -90, right: -40, child: _orb(const Color(0x2212161A), 200)),
          child,
        ],
      ),
    );
  }

  Widget _orb(Color color, double size) {
    return Container(
      width: size,
      height: size,
      decoration: BoxDecoration(
        shape: BoxShape.circle,
        color: color,
        boxShadow: [BoxShadow(color: color, blurRadius: 100)],
      ),
    );
  }
}

