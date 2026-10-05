import { defineCatalog, type Spec } from "@json-render/core";
import { schema } from "@json-render/react/schema";
import { z } from "zod";
import { componentDefs, type ComponentName } from "./components";
import type { ComponentDef } from "./defs";
import { ThemeSchema, themePresets } from "./theme";
import { designSystems } from "./designSystems";

export * from "./defs";
export * from "./components";
export * from "./theme";
export * from "./normalize";
export * from "./designSystems";
export * from "./fonts";
export * from "./patterns";
export type { Spec };

const skeletonFlag = { skeleton: z.boolean().optional() };

/** Full props schema of a component, including the `skeleton` flag. */
export function propsSchema(name: ComponentName): z.ZodObject {
  return (componentDefs[name] as ComponentDef).props.extend(skeletonFlag);
}

export const actionDefs = {
  navigate: {
    params: z.object({ frameId: z.string().min(1) }),
    description: "Prototype navigation: show another frame of the project.",
  },
};

export const catalog = defineCatalog(schema, {
  components: Object.fromEntries(
    Object.entries(componentDefs).map(([name, d]) => [
      name,
      {
        props: propsSchema(name as ComponentName),
        description: d.description,
        ...(d.slots ? { slots: [...d.slots] } : {}),
        ...(d.events ? { events: [...d.events] } : {}),
      },
    ]),
  ) as Record<ComponentName, { props: z.ZodObject; description: string }>,
  actions: actionDefs,
});

/** One skeleton candidate per component for the Jev composer. */
export function compositionCandidates() {
  return Object.entries(componentDefs as Record<string, ComponentDef>).flatMap(([name, d]) => {
    const base = {
      root: d.root ?? false,
      ...(d.maxUses ? { maxUses: d.maxUses } : {}),
    };
    if (!d.variants) {
      return [{ ...base, id: name, description: `${name}: ${d.description}`, element: { type: name, props: { ...(d.placeholder as object), skeleton: true } } }];
    }
    return d.variants.map((v) => ({
      ...base,
      id: `${name}-${v.value}`,
      description: `${name} (${v.value} layout): ${d.description} Layout: ${v.description}.`,
      element: { type: name, props: { ...(d.placeholder as object), variant: v.value, skeleton: true } },
      resource: name,
    }));
  });
}

/** Skeleton props for a component, used by the llm composer and the Components panel. */
export function placeholderProps(name: ComponentName): Record<string, unknown> {
  return structuredClone({ ...(componentDefs[name].placeholder as object), skeleton: true });
}

export function isComponentName(name: string): name is ComponentName {
  return Object.hasOwn(componentDefs, name);
}

/** JSON Schema for every component, consumed by the Go API and the Props inspector. */
export function catalogJsonSchema() {
  return {
    components: Object.fromEntries(
      Object.entries(componentDefs).map(([name, d]) => [
        name,
        {
          kind: d.kind,
          description: d.description,
          slots: d.slots ?? [],
          events: d.events ?? [],
          root: d.root ?? false,
          props: z.toJSONSchema(propsSchema(name as ComponentName), { target: "draft-2020-12" }),
          placeholder: placeholderProps(name as ComponentName),
        },
      ]),
    ),
    theme: z.toJSONSchema(ThemeSchema, { target: "draft-2020-12" }),
    themePresets,
    designSystems: designSystems.map(({ theme: _, ...d }) => d),
    actions: Object.fromEntries(
      Object.entries(actionDefs).map(([name, a]) => [
        name,
        { description: a.description, params: z.toJSONSchema(a.params, { target: "draft-2020-12" }) },
      ]),
    ),
  };
}
