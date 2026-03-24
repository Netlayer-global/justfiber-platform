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
    final resolvedBackground = color ?? const Color(0xFF15181C);
    final bool darkCard = true;
    final resolvedTextColor = textColor ?? const Color(0xFFF5F5F5);
    return Container(
      padding: padding,
      decoration: BoxDecoration(
        gradient: gradient,
        color: gradient == null ? resolvedBackground : null,
        borderRadius: BorderRadius.circular(28),
        border: Border.all(
          color: borderColor ?? const Color(0x228224E3),
          width: 1,
        ),
        boxShadow: const [
          BoxShadow(color: Color(0x44000000), blurRadius: 28, offset: Offset(0, 18)),
          BoxShadow(color: Color(0x088224E3), blurRadius: 8, offset: Offset(0, 0)),
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

