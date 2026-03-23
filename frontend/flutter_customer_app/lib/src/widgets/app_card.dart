import 'package:flutter/material.dart';

class AppCard extends StatelessWidget {
  const AppCard({
    super.key,
    required this.child,
    this.gradient,
    this.padding = const EdgeInsets.all(20),
  });

  final Widget child;
  final Gradient? gradient;
  final EdgeInsetsGeometry padding;

  @override
  Widget build(BuildContext context) {
    final bool darkCard = gradient != null;
    return Container(
      padding: padding,
      decoration: BoxDecoration(
        gradient: gradient,
        color: gradient == null ? const Color(0xFFEFEEE8) : null,
        borderRadius: BorderRadius.circular(28),
        border: Border.all(
          color: gradient == null ? const Color(0x14000000) : const Color(0x14FFFFFF),
          width: 1,
        ),
        boxShadow: const [
          BoxShadow(color: Color(0x26000000), blurRadius: 34, offset: Offset(0, 20)),
          BoxShadow(color: Color(0x12E6FF3C), blurRadius: 10, offset: Offset(0, 0)),
        ],
      ),
      child: IconTheme(
        data: IconThemeData(color: darkCard ? const Color(0xFFF5F5F5) : const Color(0xFF111111)),
        child: DefaultTextStyle.merge(
          style: TextStyle(color: darkCard ? const Color(0xFFF5F5F5) : const Color(0xFF111111)),
          child: child,
        ),
      ),
    );
  }
}

