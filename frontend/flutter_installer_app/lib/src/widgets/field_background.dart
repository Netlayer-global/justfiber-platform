import 'package:flutter/material.dart';

class FieldBackground extends StatelessWidget {
  const FieldBackground({super.key, required this.child});

  final Widget child;

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: const BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment.topCenter,
          end: Alignment.bottomCenter,
          colors: [Color(0xFF0C1018), Color(0xFF0C1018), Color(0xFF0B0F19)],
        ),
      ),
      child: Stack(
        children: [
          Positioned(top: -70, right: -40, child: _orb(const Color(0x228224E3), 220)),
          Positioned(top: 180, left: -60, child: _orb(const Color(0x111B2311), 180)),
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
        boxShadow: [BoxShadow(color: color, blurRadius: 90)],
      ),
    );
  }
}
