import { describe, it, expect } from "vitest";
import { getQuickNotes } from "./quick-notes";

describe("getQuickNotes", () => {
  it("extracts sauces from 'salsas (...)' pattern", () => {
    const notes = getQuickNotes("Papa a la francesa, salchicha, queso costeño, lechuga, papa ripio y salsas (tomate, tártara, piña)");
    expect(notes).toContain("Sin salsas");
    expect(notes).toContain("Sin tomate");
    expect(notes).toContain("Sin tártara");
    expect(notes).toContain("Sin piña");
  });

  it("detects common ingredients", () => {
    const notes = getQuickNotes("Carne de res, lechuga, ripio, queso mozzarella, salsas (tomate, mostaza, tártara) y papas a la francesa");
    expect(notes).toContain("Sin lechuga");
    expect(notes).toContain("Sin ripio");
    expect(notes).toContain("Sin queso mozzarella");
    expect(notes).toContain("Sin papas");
  });

  it("always includes 'Para llevar'", () => {
    const notes = getQuickNotes("Carne de res, lechuga");
    expect(notes).toContain("Para llevar");
  });

  it("returns only 'Para llevar' for add-on items", () => {
    expect(getQuickNotes("Jamón adicional")).toEqual(["Para llevar"]);
    expect(getQuickNotes("Queso mozzarella adicional")).toEqual(["Para llevar"]);
    expect(getQuickNotes("Porción de papas a la francesa")).toEqual(["Para llevar"]);
  });

  it("returns only 'Para llevar' for items with no recognized ingredients", () => {
    expect(getQuickNotes("Bebida refrescante")).toEqual(["Para llevar"]);
  });

  it("does not include 'Sin cebolla' when dish has no cebolla", () => {
    const notes = getQuickNotes("Carne de res, lechuga, ripio, queso mozzarella y salsas (tártara, tomate, mostaza)");
    expect(notes).not.toContain("Sin cebolla");
  });

  it("does not include 'Sin piña' when dish has no piña", () => {
    const notes = getQuickNotes("Carne de res, lechuga, ripio, queso mozzarella y salsas (tártara, tomate, mostaza)");
    expect(notes).not.toContain("Sin piña");
  });

  it("includes 'Sin piña' when dish has piña", () => {
    const notes = getQuickNotes("Long (salchicha), carne de res, lechuga, ripio, queso costeño, queso mozzarella y salsas (tártara, piña, tomate)");
    expect(notes).toContain("Sin piña");
  });

  it("includes 'Sin jamón' and 'Sin tocineta' when present", () => {
    const notes = getQuickNotes("Doble carne de res, jamón, tocineta, ripio, lechuga, queso mozzarella, salsas (tártara, tomate, mostaza) y papas a la francesa");
    expect(notes).toContain("Sin jamón");
    expect(notes).toContain("Sin tocineta");
  });

  it("orders notes: salsas first, then ingredients, then 'Para llevar'", () => {
    const notes = getQuickNotes("Carne de res, lechuga, ripio, queso mozzarella y salsas (tártara, tomate, mostaza)");
    const paraLlevarIdx = notes.indexOf("Para llevar");
    const sinSalsasIdx = notes.indexOf("Sin salsas");
    const sinLechugaIdx = notes.indexOf("Sin lechuga");
    expect(sinSalsasIdx).toBeLessThan(sinLechugaIdx);
    expect(sinLechugaIdx).toBeLessThan(paraLlevarIdx);
  });
});
