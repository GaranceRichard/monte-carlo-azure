def round_positive_ratio_half_up(
    numerator: int,
    denominator: int,
    decimal_places: int = 4,
) -> float:
    scale = 10**decimal_places
    quotient, remainder = divmod(numerator * scale, denominator)
    if remainder * 2 >= denominator:
        quotient += 1
    return quotient / scale
