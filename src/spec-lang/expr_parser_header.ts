// Need the ts-nocheck to suppress the noUnusedLocals errors in the generated parser
// @ts-nocheck
import bigInt from "big-integer";
import {
    SId,
    SNode,
    SNumber,
    SBooleanLiteral,
    SHexLiteral,
    SStringLiteral,
    SUnaryOperation,
    UnaryOperator,
    SBinaryOperation,
    MultiplicativeBinaryOperator,
    AdditiveBinaryOperator,
    ShiftBinaryOperator,
    SMemberAccess,
    SIndexAccess,
    SFunctionCall,
    SConditional,
    SLet,
    SBoolType,
    SAddressType,
    SIntType,
    SFixedBytes,
    SBytes,
    SPointer,
    SString,
    SArrayType,
    SMemberAccess,
    SUserDefinedType,
    SMappingType,
    SFunctionType,
    Range,
    SAddressLiteral,
    SResult
} from "./ast";

function buildBinaryExpression(head: SNode, tail: Array<[string, SNode]>, src?: Range): SNode {
    return tail.reduce((acc, [whiteSp, curOp, whiteSP, curVal]) => {
        return new SBinaryOperation(acc, curOp, curVal, src);
    }, head);
}
