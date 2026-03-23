import 'package:flutter/material.dart';

class AppCard extends StatelessWidget {
  const AppCard({
    super.key,
    required this.child,
    this.gradient,
    this.color,
    this.borderColor,
    this.textColor,
    this.padding = const EdgeInsets.all(20),
  });

  final Widget child;
  final Gradient? gradient;
  final Color? color;
  final Color? borderColor;
  final Color? textColor;
  final EdgeInsetsGeometry padding;

  @override
  Widget build(BuildContext context) {
    final bool darkCard = gradient != null || color != null;
    final resolvedTextColor = textColor ?? (darkCard ? const Color(0xFFF5F5F5) : const Color(0xFF111111));
    return Container(
      padding: padding,
      decoration: BoxDecoration(
        gradient: gradient,
        color: gradient == null ? (color ?? const Color(0xFFEFEEE8)) : null,
        borderRadius: BorderRadius.circular(28),
        border: Border.all(
          color: borderColor ?? (gradient == null ? const Color(0x1CE6FF3C) : const Color(0x22E6FF3C)),
          width: 1,
        ),
        boxShadow: const [
          BoxShadow(color: Color(0x30000000), blurRadius: 34, offset: Offset(0, 20)),
          BoxShadow(color: Color(0x16E6FF3C), blurRadius: 14, offset: Offset(0, 0)),
        ],
      ),
      child: IconTheme(
        data: IconThemeData(color: resolvedTextColor),
        child: DefaultTextStyle.merge(
          style: TextStyle(color: resolvedTextColor),
          child: child,
        ),
      ),
    );
  }
}

