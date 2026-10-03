import type { ComponentRegistry, ComponentRenderProps } from "@json-render/react";
import type { Spec } from "@ui-factory/catalog";
import { componentDefs } from "@ui-factory/catalog";
import { renders, skeletons } from "./blocks";

/** Element keys are not passed to components, so the frame injects them as `__id`. */
export function tagSpec(spec: Spec): Spec {
  const elements = Object.fromEntries(
    Object.entries(spec.elements).map(([id, el]) => [id, { ...el, props: { ...el.props, __id: id } }]),
  );
  return { ...spec, elements };
}

function wrap(type: keyof typeof componentDefs) {
  const Real = renders[type];
  const Skeleton = skeletons[type];
  return function Element({ element, children, slots, emit }: ComponentRenderProps) {
    const { __id, skeleton, ...props } = element.props as Record<string, unknown>;
    const Render = skeleton ? Skeleton : Real;
    const allSlots = { ...(slots ?? {}), default: children };
    const inline = componentDefs[type].kind === "primitive";
    const Tag = inline ? "span" : "div";
    return (
      <Tag
        data-el-id={__id as string}
        data-el-type={type}
        className={skeleton ? undefined : "fill-in"}
        style={inline ? { display: "inline-block" } : undefined}
      >
        <Render props={props as never} slots={allSlots} emit={emit} />
      </Tag>
    );
  };
}

export const registry: ComponentRegistry = Object.fromEntries(
  Object.keys(componentDefs).map((t) => [t, wrap(t as keyof typeof componentDefs)]),
);
