import 'package:flutter/material.dart';

import '../core/theme.dart';

class AppCard extends StatelessWidget {
  const AppCard({
    super.key,
    required this.child,
    this.gradient,
    this.color,
    this.borderColor,
    this.padding = const EdgeInsets.all(20),
  });

  final Widget child;
  final Gradient? gradient;
  final Color? color;
  final Color? borderColor;
  final EdgeInsetsGeometry padding;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: padding,
      decoration: BoxDecoration(
        gradient: gradient,
        color: gradient == null ? (color ?? kSurface) : null,
        borderRadius: BorderRadius.circular(28),
        border:
            gradient == null ? Border.all(color: borderColor ?? kBorder) : null,
        boxShadow: const [
          BoxShadow(
              color: Color(0x338B1CF6), blurRadius: 28, offset: Offset(0, 16)),
        ],
      ),
      child: child,
    );
  }
}
