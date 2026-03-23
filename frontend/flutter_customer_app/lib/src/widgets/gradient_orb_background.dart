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
          colors: [Color(0xFF080808), Color(0xFF050505), Color(0xFF0D0F08)],
        ),
      ),
      child: Stack(
        children: [
          Positioned(top: -80, right: -30, child: _orb(const Color(0x22E6FF3C), 220)),
          Positioned(top: 240, left: -70, child: _orb(const Color(0x18E6FF3C), 180)),
          Positioned(bottom: -90, right: -40, child: _orb(const Color(0x22111111), 200)),
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

