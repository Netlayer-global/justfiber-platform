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
          colors: [Color(0xFFFFFFFF), Color(0xFFF8F6FF), Color(0xFFEEF2FF)],
        ),
      ),
      child: Stack(
        children: [
          Positioned(top: -90, right: -24, child: _orb(const Color(0x228224E3), 240)),
          Positioned(top: 220, left: -90, child: _orb(const Color(0x128224E3), 200)),
          Positioned(bottom: -100, right: -30, child: _orb(const Color(0x18C7D2FE), 220)),
          Positioned(bottom: 80, left: 30, child: _orb(const Color(0x0CFFFFFF), 140)),
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
