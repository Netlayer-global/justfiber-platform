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
          colors: [Color(0xFFF8F5FC), Color(0xFFF5F0FB), Color(0xFFF1EBFA)],
        ),
      ),
      child: Stack(
        children: [
          Positioned(
            top: -60,
            right: -20,
            child: Container(
              width: 180,
              height: 180,
              decoration: const BoxDecoration(
                shape: BoxShape.circle,
                gradient: RadialGradient(
                  colors: [Color(0x168224E3), Color(0x008224E3)],
                ),
              ),
            ),
          ),
          Positioned(
            left: -40,
            bottom: -80,
            child: Container(
              width: 220,
              height: 220,
              decoration: const BoxDecoration(
                shape: BoxShape.circle,
                gradient: RadialGradient(
                  colors: [Color(0x0FA855F7), Color(0x00A855F7)],
                ),
              ),
            ),
          ),
          child,
        ],
      ),
    );
  }
}
