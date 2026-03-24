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
          colors: [Color(0xFFFFFFFF), Color(0xFFFAFBFF), Color(0xFFF3F5FB)],
        ),
      ),
      child: Stack(
        children: [
          Positioned(top: -70, right: -40, child: _orb(const Color(0x148224E3), 210)),
          Positioned(top: 220, left: -70, child: _orb(const Color(0x0AC7D2FE), 160)),
          Positioned(bottom: -50, right: 10, child: _orb(const Color(0x0E8224E3), 170)),
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
