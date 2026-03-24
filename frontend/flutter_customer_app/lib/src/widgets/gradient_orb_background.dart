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
          colors: [Color(0xFFF9F5EF), Color(0xFFF6F1EB), Color(0xFFF1EBE3)],
        ),
      ),
      child: Stack(
        children: [
          Positioned(top: -80, right: -40, child: _orb(const Color(0x128224E3), 210)),
          Positioned(top: 260, left: -80, child: _orb(const Color(0x08D6D3FF), 160)),
          Positioned(bottom: -70, right: -30, child: _orb(const Color(0x0C8224E3), 180)),
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
