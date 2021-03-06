import {
    ContractDefinition,
    DataLocation,
    FunctionStateMutability,
    FunctionVisibility,
    SourceUnit
} from "solc-typed-ast";
import expect from "expect";
import { Logger } from "../../src/logger";
import {
    SAddressType,
    SArrayType,
    SBytes,
    SFixedBytes,
    SFunctionType,
    SIntLiteralType,
    SIntType,
    SPointer,
    SBuiltinTypeNameType,
    SString,
    STupleType,
    SType,
    SUserDefinedType
} from "../../src/spec-lang/ast";
import { SBoolType } from "../../src/spec-lang/ast/types/bool";
import { parse } from "../../src/spec-lang/expr_parser";
import { STypingCtx, tc } from "../../src/spec-lang/tc";
import { eq } from "../../src/util/struct_equality";
import { findContract, findFunction, toAst } from "../integration/utils";
import { SStringLiteralType } from "../../src/spec-lang/ast/types/string_literal";

export type LocationDesc = [string, string | undefined];

describe("TypeChecker Unit Tests", () => {
    const goodSamples: Array<[string, string, Array<[string, LocationDesc, SType]>]> = [
        [
            "foo.sol",
            `pragma solidity 0.6.0;

            enum GlobalEnum {
                A,
                B,
                C
            }
            
            library Lib {
                function ladd(uint32 a, uint32 b) public returns (uint32) {
                    return a+b;
                }
            }

            library Lib2 {
                function foo(int128 x) public returns (bool) {
                    return true;
                }
            }

            library Lib3 {
                function len(string memory s) public returns (uint) {
                    return bytes(s).length;
                }
            }

            interface IFace {
                function imoo(int8 d, int16 e) external returns (address, string memory);
            }

            contract Boo {
                uint a;
                int8 public s;
                string str;

                enum BooEnum {
                    G,
                    H,
                    I
                }

                function foo(uint x) public returns (uint) {
                    return x;
                }
            }

            contract Foo {
                uint sV;
                int128 sV1;
                address sA;
                address payable sA1;
                bool sB;

                string sS;
                bytes sBy;
                uint[] sUArr;
                uint[5] sUFixedArr;
                int64[] sI64Arr;
                uint8[][] sNestedArr;
                bytes32 sFB32;
                bytes16 sFB16;
                uint32 u32a;
                uint32 u32b;
                using Lib for uint32;
                using Lib2 for *;
                using Lib3 for string;

                enum FooEnum {
                    D,
                    E,
                    F
                }

                struct SFoo {
                    uint x;
                    address a;
                    string s;
                }

                struct SMoo {
                    SFoo foo;
                }

                struct Goo {
                    bytes f1;
                    bytes f2;
                }

                Goo[] goos;

                SFoo sFoo;
                SMoo sMoo;
                Boo sBoo;

                mapping (uint32 => int64) sM;

                function add(int8 x, uint64 y) public returns(uint64 add) {
                    return uint64(x) + y;
                }

                function foo(uint[] memory mUArr, bytes memory mBy, string memory mS) public {
                }

                function idPair(uint x, uint y) public returns (uint, uint) {
                    return (x,y);
                }
            }`,
            [
                ["uint", ["Foo", undefined], new SBuiltinTypeNameType(new SIntType(256, false))],
                ["int24", ["Foo", undefined], new SBuiltinTypeNameType(new SIntType(24, true))],
                ["byte", ["Foo", undefined], new SBuiltinTypeNameType(new SFixedBytes(1))],
                ["bytes3", ["Foo", undefined], new SBuiltinTypeNameType(new SFixedBytes(3))],
                ["string", ["Foo", undefined], new SBuiltinTypeNameType(new SString())],
                [
                    "address payable",
                    ["Foo", undefined],
                    new SBuiltinTypeNameType(new SAddressType(true))
                ],
                ["true", ["Foo", undefined], new SBoolType()],
                ["1", ["Foo", undefined], new SIntLiteralType()],
                ["hex'0011ff'", ["Foo", undefined], new SStringLiteralType()],
                ['hex""', ["Foo", undefined], new SStringLiteralType()],
                ['"abc \\" \\u0000 \\x01 Def "', ["Foo", undefined], new SStringLiteralType()],
                ["''", ["Foo", undefined], new SStringLiteralType()],
                ["1e10", ["Foo", undefined], new SIntLiteralType()],
                ["10e+5", ["Foo", undefined], new SIntLiteralType()],
                ["1000e-2", ["Foo", undefined], new SIntLiteralType()],
                [
                    "0xAaaaAaAAaaaAAaAAaAaaaaAAAAAaAaaaAaAaaAA0",
                    ["Foo", undefined],
                    new SAddressType(true)
                ],
                [
                    "0xAaaaAaAAaaaAAaAAaAaaaaAAAAAaAaaaAaAaaAA0.balance",
                    ["Foo", undefined],
                    new SIntType(256, false)
                ],
                ["sV", ["Foo", undefined], new SIntType(256, false)],
                ["sV1", ["Foo", undefined], new SIntType(128, true)],
                ["sA", ["Foo", undefined], new SAddressType(false)],
                ["sA1", ["Foo", "add"], new SAddressType(true)],
                ["x", ["Foo", "add"], new SIntType(8, true)],
                ["y", ["Foo", "add"], new SIntType(64, false)],
                ["add", ["Foo", "add"], new SIntType(64, false)],
                ["-x", ["Foo", "add"], new SIntType(8, true)],
                ["-x", ["Foo", "add"], new SIntType(8, true)],
                ["!sB", ["Foo", undefined], new SBoolType()],
                ["x+x", ["Foo", "add"], new SIntType(8, true)],
                ["x-16", ["Foo", "add"], new SIntType(8, true)],
                ["24*x", ["Foo", "add"], new SIntType(8, true)],
                ["x/sV1", ["Foo", "add"], new SIntType(128, true)],
                ["y%123", ["Foo", "add"], new SIntType(64, false)],
                ["33%5", ["Foo", "add"], new SIntLiteralType()],
                ["3**2", ["Foo", undefined], new SIntLiteralType()],
                ["y**2", ["Foo", "add"], new SIntType(64, false)],
                ["2**y", ["Foo", "add"], new SIntType(64, false)],
                ["y**sV", ["Foo", "add"], new SIntType(64, false)],
                ["y>>x", ["Foo", "add"], new SIntType(64, false)],
                ["y>>5", ["Foo", "add"], new SIntType(64, false)],
                ["5<<5", ["Foo", "add"], new SIntLiteralType()],
                ["sFB32<<5", ["Foo", "add"], new SFixedBytes(32)],
                ["sFB32<<sV", ["Foo", "add"], new SFixedBytes(32)],
                ["5>>y", ["Foo", "add"], new SIntType(64, false)],
                ["5>y", ["Foo", "add"], new SBoolType()],
                ["sV<y", ["Foo", "add"], new SBoolType()],
                ["x<=sV1", ["Foo", "add"], new SBoolType()],
                ["10>=x", ["Foo", "add"], new SBoolType()],
                ["10==x", ["Foo", "add"], new SBoolType()],
                ["sV1!=x", ["Foo", "add"], new SBoolType()],
                ["sA==sA1", ["Foo", "add"], new SBoolType()],
                ["5 | 1235", ["Foo", "add"], new SIntLiteralType()],
                ["5 & x", ["Foo", "add"], new SIntType(8, true)],
                ["y ^ sV", ["Foo", "add"], new SIntType(256, false)],
                ["sB || sB", ["Foo", undefined], new SBoolType()],
                ["true && false", ["Foo", undefined], new SBoolType()],
                ["true ==> sB", ["Foo", undefined], new SBoolType()],
                ["true ? 1 : 2", ["Foo", undefined], new SIntLiteralType()],
                ["sB ? x : 2", ["Foo", "add"], new SIntType(8, true)],
                ["sB ? x : sV1", ["Foo", "add"], new SIntType(128, true)],
                ["sB ? sA1 : sA", ["Foo", undefined], new SAddressType(false)],
                ["sS", ["Foo", undefined], new SPointer(new SString(), DataLocation.Storage)],
                ["sBy", ["Foo", undefined], new SPointer(new SBytes(), DataLocation.Storage)],
                [
                    "sUArr",
                    ["Foo", undefined],
                    new SPointer(new SArrayType(new SIntType(256, false)), DataLocation.Storage)
                ],
                [
                    "sUFixedArr",
                    ["Foo", undefined],
                    new SPointer(new SArrayType(new SIntType(256, false), 5), DataLocation.Storage)
                ],
                [
                    "sI64Arr",
                    ["Foo", undefined],
                    new SPointer(new SArrayType(new SIntType(64, true)), DataLocation.Storage)
                ],
                [
                    "sNestedArr",
                    ["Foo", undefined],
                    new SPointer(
                        new SArrayType(
                            new SPointer(
                                new SArrayType(new SIntType(8, false)),
                                DataLocation.Storage
                            )
                        ),
                        DataLocation.Storage
                    )
                ],
                ["sFB32", ["Foo", undefined], new SFixedBytes(32)],
                ["sFB16", ["Foo", undefined], new SFixedBytes(16)],
                [
                    "mUArr",
                    ["Foo", "foo"],
                    new SPointer(new SArrayType(new SIntType(256, false)), DataLocation.Memory)
                ],
                ["mBy", ["Foo", "foo"], new SPointer(new SBytes(), DataLocation.Memory)],
                ["mS", ["Foo", "foo"], new SPointer(new SString(), DataLocation.Memory)],
                ["sBy[1]", ["Foo", undefined], new SIntType(8, false)],
                ["sBy[sV]", ["Foo", undefined], new SIntType(8, false)],
                ["sBy[sV1]", ["Foo", undefined], new SIntType(8, false)],
                ["sFB32[4]", ["Foo", undefined], new SIntType(8, false)],
                ["sFB32[sV1]", ["Foo", undefined], new SIntType(8, false)],
                ["sUArr[sV]", ["Foo", undefined], new SIntType(256, false)],
                ["sUFixedArr[sV]", ["Foo", undefined], new SIntType(256, false)],
                ["sI64Arr[sV]", ["Foo", undefined], new SIntType(64, true)],
                [
                    "sNestedArr[sV]",
                    ["Foo", undefined],
                    new SPointer(new SArrayType(new SIntType(8, false)), DataLocation.Storage)
                ],
                ["sNestedArr[sV][0]", ["Foo", undefined], new SIntType(8, false)],
                ["sM[0]", ["Foo", undefined], new SIntType(64, true)],
                ["sM[u32a]", ["Foo", undefined], new SIntType(64, true)],
                ["sM[sNestedArr[0][0]]", ["Foo", undefined], new SIntType(64, true)],
                [
                    "sFoo",
                    ["Foo", undefined],
                    new SPointer(new SUserDefinedType("Foo.SFoo"), DataLocation.Storage)
                ],
                [
                    "sBoo",
                    ["Foo", undefined],
                    new SPointer(new SUserDefinedType("Boo"), DataLocation.Storage)
                ],
                ["sFoo.x", ["Foo", undefined], new SIntType(256, false)],
                ["sFoo.a", ["Foo", undefined], new SAddressType(false)],
                ["sFoo.a.balance", ["Foo", undefined], new SIntType(256, false)],
                ["sBoo.balance", ["Foo", undefined], new SIntType(256, false)],
                ["sFoo.s", ["Foo", undefined], new SPointer(new SString(), DataLocation.Storage)],
                [
                    "sMoo",
                    ["Foo", undefined],
                    new SPointer(new SUserDefinedType("Foo.SMoo"), DataLocation.Storage)
                ],
                ["sMoo.foo.x", ["Foo", undefined], new SIntType(256, false)],
                [
                    "goos[0].f2",
                    ["Foo", undefined],
                    new SPointer(new SBytes(), DataLocation.Storage)
                ],
                ["add(5,5)", ["Foo", undefined], new SIntType(64, false)],
                ["old(5)", ["Foo", undefined], new SIntLiteralType()],
                ["old(sV1)", ["Foo", undefined], new SIntType(128, true)],
                ["old(sA)", ["Foo", undefined], new SAddressType(false)],
                ["this.add(5,5)", ["Foo", undefined], new SIntType(64, false)],
                ["sBoo.foo(5)", ["Foo", undefined], new SIntType(256, false)],
                [
                    "IFace(address(0x0))",
                    ["Foo", undefined],
                    new SPointer(new SUserDefinedType("IFace"), DataLocation.Storage)
                ],
                [
                    "IFace(address(0x0)).imoo(5,10)",
                    ["Foo", undefined],
                    new STupleType([
                        new SAddressType(false),
                        new SPointer(new SString(), DataLocation.Memory)
                    ])
                ],
                ["uint256(u32a)", ["Foo", undefined], new SIntType(256, false)],
                ["int256(u32a)", ["Foo", undefined], new SIntType(256, true)],
                ["bytes32(uint256(u32a))", ["Foo", undefined], new SFixedBytes(32)],
                ["Lib.ladd(u32a, u32b)", ["Foo", undefined], new SIntType(32, false)],
                ["u32a.ladd(u32b)", ["Foo", undefined], new SIntType(32, false)],
                ["sS.len()", ["Foo", undefined], new SIntType(256, false)],
                ["sV1.foo()", ["Foo", undefined], new SBoolType()],
                ["FooEnum.D", ["Foo", undefined], new SUserDefinedType("Foo.FooEnum")],
                ["GlobalEnum.A", ["Foo", undefined], new SUserDefinedType("GlobalEnum")],
                ["Boo.BooEnum.G", ["Foo", undefined], new SUserDefinedType("Boo.BooEnum")],
                ["sA.balance", ["Foo", undefined], new SIntType(256, false)],
                [
                    "sA.staticcall",
                    ["Foo", undefined],
                    new SFunctionType(
                        [new SPointer(new SBytes(), DataLocation.Memory)],
                        [new SBoolType(), new SPointer(new SBytes(), DataLocation.Memory)],
                        FunctionVisibility.Default,
                        FunctionStateMutability.View
                    )
                ],
                ["block.coinbase", ["Foo", undefined], new SAddressType(true)],
                ["block.difficulty", ["Foo", undefined], new SIntType(256, false)],
                ["block.gaslimit", ["Foo", undefined], new SIntType(256, false)],
                ["block.number", ["Foo", undefined], new SIntType(256, false)],
                ["block.timestamp", ["Foo", undefined], new SIntType(256, false)],
                ["msg.data", ["Foo", undefined], new SPointer(new SBytes(), DataLocation.CallData)],
                ["msg.sender", ["Foo", undefined], new SAddressType(true)],
                ["msg.sig", ["Foo", undefined], new SFixedBytes(4)],
                ["msg.value", ["Foo", undefined], new SIntType(256, false)],
                ["tx.gasprice", ["Foo", undefined], new SIntType(256, false)],
                ["tx.origin", ["Foo", undefined], new SAddressType(true)],
                [
                    "blockhash",
                    ["Foo", undefined],
                    new SFunctionType(
                        [new SIntType(256, false)],
                        [new SFixedBytes(32)],
                        FunctionVisibility.Default,
                        FunctionStateMutability.View
                    )
                ],
                [
                    "gasleft",
                    ["Foo", undefined],
                    new SFunctionType(
                        [],
                        [new SIntType(256, false)],
                        FunctionVisibility.Default,
                        FunctionStateMutability.View
                    )
                ],
                [
                    "now",
                    ["Foo", undefined],
                    new SFunctionType(
                        [],
                        [new SIntType(256, false)],
                        FunctionVisibility.Default,
                        FunctionStateMutability.View
                    )
                ],
                [
                    "addmod",
                    ["Foo", undefined],
                    new SFunctionType(
                        [
                            new SIntType(256, false),
                            new SIntType(256, false),
                            new SIntType(256, false)
                        ],
                        [new SIntType(256, false)],
                        FunctionVisibility.Default,
                        FunctionStateMutability.Pure
                    )
                ],
                [
                    "mulmod",
                    ["Foo", undefined],
                    new SFunctionType(
                        [
                            new SIntType(256, false),
                            new SIntType(256, false),
                            new SIntType(256, false)
                        ],
                        [new SIntType(256, false)],
                        FunctionVisibility.Default,
                        FunctionStateMutability.Pure
                    )
                ],
                [
                    "keccak256",
                    ["Foo", undefined],
                    new SFunctionType(
                        [new SPointer(new SBytes(), DataLocation.Memory)],
                        [new SFixedBytes(32)],
                        FunctionVisibility.Default,
                        FunctionStateMutability.Pure
                    )
                ],
                [
                    "sha256",
                    ["Foo", undefined],
                    new SFunctionType(
                        [new SPointer(new SBytes(), DataLocation.Memory)],
                        [new SFixedBytes(32)],
                        FunctionVisibility.Default,
                        FunctionStateMutability.Pure
                    )
                ],
                [
                    "ripemd160",
                    ["Foo", undefined],
                    new SFunctionType(
                        [new SPointer(new SBytes(), DataLocation.Memory)],
                        [new SFixedBytes(20)],
                        FunctionVisibility.Default,
                        FunctionStateMutability.Pure
                    )
                ],
                [
                    "ecrecover",
                    ["Foo", undefined],
                    new SFunctionType(
                        [
                            new SFixedBytes(32),
                            new SIntType(8, false),
                            new SFixedBytes(32),
                            new SFixedBytes(32)
                        ],
                        [new SAddressType(false)],
                        FunctionVisibility.Default,
                        FunctionStateMutability.Pure
                    )
                ],
                ["$result", ["Foo", "add"], new SIntType(64, false)],
                [
                    "$result",
                    ["Foo", "idPair"],
                    new STupleType([new SIntType(256, false), new SIntType(256, false)])
                ]
            ]
        ]
    ];

    const badSamples: Array<[string, string, Array<[string, LocationDesc]>]> = [
        [
            "foo.sol",
            `pragma solidity 0.6.0;

            enum GlobalEnum {
                A,
                B,
                C
            }

            library Lib {
                function ladd(uint32 a, uint32 b) public returns (uint32) {
                    return a+b;
                }
            }

            library Lib2 {
                function foo(int128 x) public returns (bool) {
                    return true;
                }
            }
            
            interface IFace {
                function imoo(int8 d, int16 e) external returns (address, string memory);
            }

            contract Boo {
                enum BooEnum {
                    G,
                    H,
                    I
                }
            }

            contract Foo {
                uint sV;
                int128 sV1;
                address sA;
                bool b;
                using Lib2 for *;

                mapping (uint32 => int64) sM;

                function add(uint x, uint y) public returns(uint add) {
                    return x + y;
                }

                function noReturn(uint x) public {}
            }`,
            [
                ["int23", ["Foo", undefined]],
                ["int264", ["Foo", undefined]],
                ["bytes33", ["Foo", undefined]],
                ["sMissing", ["Foo", undefined]],
                ["sMissing", ["Foo", "add"]],
                ["x", ["Foo", undefined]],
                ["!sV", ["Foo", undefined]],
                ["-sA", ["Foo", undefined]],
                ["x+y", ["Foo", undefined]],
                ["sV1/sV", ["Foo", undefined]],
                ["sV1%sA", ["Foo", undefined]],
                ["sV**sV1", ["Foo", undefined]],
                ["2**sV1", ["Foo", undefined]],
                ["x<<sA", ["Foo", undefined]],
                ["sA<<x", ["Foo", undefined]],
                ["x<<x", ["Foo", undefined]],
                ["x<<5", ["Foo", undefined]],
                ["y<=sV1", ["Foo", "add"]],
                ["sA>sA", ["Foo", "add"]],
                ["sA==x", ["Foo", "add"]],
                ["sA!=1", ["Foo", "add"]],
                ["x==sV1", ["Foo", "add"]],
                ["x&sV1", ["Foo", "add"]],
                ["sA&sA", ["Foo", "add"]],
                ["x&sA", ["Foo", "add"]],
                ["b || sV", ["Foo", "add"]],
                ["sA && true", ["Foo", "add"]],
                ["x ? 1 : 2", ["Foo", "add"]],
                ["sS[1]", ["Foo", undefined]],
                ["sV[1]", ["Foo", undefined]],
                ["sM[sV]", ["Foo", undefined]],
                ["sM[sV1]", ["Foo", undefined]],
                ["sM[sA]", ["Foo", undefined]],
                ["sV1.balance", ["Foo", undefined]],
                ["add(5)", ["Foo", undefined]],
                ["add(5, true)", ["Foo", undefined]],
                ["add(5, int256(5))", ["Foo", undefined]],
                ["noFunc(5, 5)", ["Foo", undefined]],
                // @todo This should not type check. Fix later on
                //["IFace.imoo(5,10)", ["Foo", undefined]],
                ["Lib.ladd(sV1, sV1)", ["Foo", undefined]],
                ["sBoo.a", ["Foo", undefined]],
                ["sBoo.s", ["Foo", undefined]],
                ["sBoo.str", ["Foo", undefined]],
                ["sA.foo()", ["Foo", undefined]],
                ["FooEnum.X", ["Foo", undefined]],
                ["BooEnum.G", ["Foo", undefined]],
                ["sA.any", ["Foo", undefined]],
                ["block.any", ["Foo", undefined]],
                ["msg.any", ["Foo", undefined]],
                ["tx.any", ["Foo", undefined]],
                ["$result", ["Foo", undefined]],
                ["$result", ["Foo", "noReturn"]]
            ]
        ]
    ];

    for (const [fileName, content, testCases] of goodSamples) {
        describe(`Positive tests for #${fileName}`, () => {
            let sources: SourceUnit[];

            before(() => {
                [sources] = toAst(fileName, content);
            });

            for (const [specString, loc, expectedType] of testCases) {
                it(`Typecheck for ${specString} returns ${expectedType.pp()}`, () => {
                    const parsed = parse(specString);
                    const ctx: STypingCtx = [sources, findContract(loc[0], sources)];
                    if (loc[1] !== undefined) {
                        ctx.push(findFunction(loc[1], ctx[1] as ContractDefinition));
                    }
                    const type = tc(parsed, ctx);
                    Logger.debug(
                        `[${specString}]: Got: ${type.pp()} expected: ${expectedType.pp()}`
                    );
                    expect(eq(type, expectedType)).toEqual(true);
                });
            }
        });
    }

    for (const [fileName, content, testCases] of badSamples) {
        describe(`Negative tests for #${fileName}`, () => {
            let sources: SourceUnit[];

            before(() => {
                [sources] = toAst(fileName, content);
            });

            for (const [specString, loc] of testCases) {
                it(`Typecheck for ${specString} throws`, () => {
                    const parsed = parse(specString);
                    const ctx: STypingCtx = [sources, findContract(loc[0], sources)];
                    if (loc[1] !== undefined) {
                        ctx.push(findFunction(loc[1], ctx[1] as ContractDefinition));
                    }
                    expect(tc.bind(tc, parsed, ctx)).toThrow();
                });
            }
        });
    }
});
