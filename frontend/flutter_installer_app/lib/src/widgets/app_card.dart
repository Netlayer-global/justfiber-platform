import 'package:flutter/material.dart';

class AppCard extends StatelessWidget {
  const AppCard({
    super.key,
    required this.child,
    this.gradient,
    this.color,
    this.borderColor,
  });

  final Widget child;
  final Gradient? gradient;
  final Color? color;
  final Color? borderColor;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        gradient: gradient,
        color: gradient == null ? (color ?? const Color(0xFF10151A)) : null,
        borderRadius: BorderRadius.circular(28),
        border: Border.all(color: borderColor ?? const Color(0x228224E3)),
        boxShadow: const [
          BoxShadow(color: Color(0x22000000), blurRadius: 24, offset: Offset(0, 16)),
        ],
      ),
      child: child,
    );
  }
}
