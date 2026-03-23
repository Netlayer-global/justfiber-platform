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
    final resolvedBackground = color ?? const Color(0xFF101215);
    final bool darkCard = true;
    final resolvedTextColor = textColor ?? const Color(0xFFF5F5F5);
    return Container(
      padding: padding,
      decoration: BoxDecoration(
        gradient: gradient,
        color: gradient == null ? resolvedBackground : null,
        borderRadius: BorderRadius.circular(28),
        border: Border.all(
          color: borderColor ?? const Color(0x22E6FF3C),
          width: 1,
        ),
        boxShadow: const [
          BoxShadow(color: Color(0x38000000), blurRadius: 28, offset: Offset(0, 18)),
          BoxShadow(color: Color(0x0FE6FF3C), blurRadius: 10, offset: Offset(0, 0)),
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

