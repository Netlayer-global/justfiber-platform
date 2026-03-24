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
          colors: [Color(0xFFFFFFFF), Color(0xFFFAFBFF), Color(0xFFF3F5FB)],
        ),
      ),
      child: Stack(
        children: [
          Positioned(top: -70, right: -40, child: _orb(const Color(0x148224E3), 210)),
          Positioned(top: 260, left: -80, child: _orb(const Color(0x0AC7D2FE), 160)),
          Positioned(bottom: -70, right: -30, child: _orb(const Color(0x0E8224E3), 180)),
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
