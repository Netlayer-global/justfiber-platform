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
          colors: [Color(0xFFFFFFFF), Color(0xFFF8F6FF), Color(0xFFEEF2FF)],
        ),
      ),
      child: Stack(
        children: [
          Positioned(top: -80, right: -30, child: _orb(const Color(0x228224E3), 240)),
          Positioned(top: 180, left: -60, child: _orb(const Color(0x12C7D2FE), 190)),
          Positioned(bottom: 100, right: 40, child: _orb(const Color(0x12FFFFFF), 130)),
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
