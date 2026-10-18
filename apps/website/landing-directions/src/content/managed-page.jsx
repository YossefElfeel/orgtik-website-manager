import React from "react";
import snapshot from "./snapshot.js";
import { currentLocale, wordsOf, bare } from "./locale.js";
import { routeOf } from "./heads.js";
import sections from "../../../../../program/cms/sections.json";
import "../reference/cms-content.css";

const asset = (src) =>
  /^https?:\/\//.test(src) ? src : `/assets/${src.replace(/^\/+/, "")}`;
const safeLink = (value) =>
  typeof value === "string" && /^(https?:\/\/|\/(?!\/)|#)/.test(value)
    ? value
    : undefined;
export function faqLabel() {
  return (
    wordsOf(
      snapshot.entries.page.find((entry) => entry.id === "pg_faq")?.locales,
    )?.hero?.title ?? "FAQ"
  );
}
export function SectionMedia({ items = [] }) {
  return items.length ? (
    <div className="cms-section-media">
      {items
        .filter((item) => item?.src)
        .map((item, index) =>
          /\.(mp4|webm)(\?|$)/i.test(item.src) ? (
            <video
              key={index}
              src={asset(item.src)}
              aria-label={item.alt?.[currentLocale()] ?? item.alt?.en ?? undefined}
              controls
              preload="metadata"
            />
          ) : (
            <img
              key={index}
              src={asset(item.src)}
              alt={item.alt?.[currentLocale()] ?? item.alt?.en ?? ""}
              style={{
                objectPosition: `${item.focal?.x ?? 50}% ${item.focal?.y ?? 50}%`,
              }}
              loading="lazy"
            />
          ),
        )}
    </div>
  ) : null;
}

export function SharedMedia({ id, prefixes }) {
  const entry = snapshot.entries.global.find(row => row.id === id);
  const items = Object.entries(entry?.presentation?.sectionMedia ?? {})
    .filter(([key]) => !prefixes || prefixes.some(prefix => key.startsWith(prefix)))
    .flatMap(([, media]) => media);
  return <SectionMedia items={items} />;
}

/** Reorder React children before reconciliation. Header, footer and nested steps stay intact. */
export function managedPageTree(tree, pageId) {
  const entry = snapshot.entries.page.find((entry) => entry.id === pageId);
  const presentation = entry?.presentation;
  const body = sections[pageId]?.body ?? [];
  const order = [
    ...new Set([
      ...(presentation?.sectionOrder ?? []).filter((key) => body.includes(key)),
      ...body,
    ]),
  ];
  const cursor = presentation?.cursor;
  const text = cursor?.text?.[currentLocale()] ?? cursor?.text?.en;
  const route =
    typeof window === "undefined"
      ? null
      : routeOf(bare(window.location.pathname));
  const recordMedia =
    route?.kind !== "page"
      ? Object.values(route?.entry?.presentation?.sectionMedia ?? {}).flat()
      : [];
  function visit(node) {
    if (!React.isValidElement(node)) return node;
    const flatten = (children, prefix = "") =>
      React.Children.toArray(children).flatMap((child, index) => {
        const key = `${prefix}/${React.isValidElement(child) ? (child.key ?? index) : index}`;
        return React.isValidElement(child) && child.type === React.Fragment
          ? flatten(child.props.children, key)
          : [
              React.isValidElement(child)
                ? React.cloneElement(child, { key })
                : child,
            ];
      });
    let children = flatten(node.props.children).map(visit);
    const slots = children
      .map((child, index) =>
        React.isValidElement(child) &&
        body.includes(child.props["data-cms-section"])
          ? index
          : -1,
      )
      .filter((index) => index >= 0);
    const sorted = slots
      .map((index) => children[index])
      .sort(
        (a, b) =>
          order.indexOf(a.props["data-cms-section"]) -
          order.indexOf(b.props["data-cms-section"]),
      );
    slots.forEach((index, n) => {
      children[index] = sorted[n];
    });
    const props = {};
    if (text && node.props["data-cursor-label"] !== undefined)
      children = [text];
    if (node.props["data-cursor"] !== undefined) {
      if (text) props["data-cursor"] = text;
      // A card's existing link or click handler always wins.
      if (!node.props.href && !node.props.onClick && safeLink(cursor?.link)) {
        props.onClick = () => window.__orgNav?.(cursor.link);
        props.role = "link";
        props.tabIndex = 0;
        props.onKeyDown = (event) => {
          if (event.key === "Enter") window.__orgNav?.(cursor.link);
        };
      }
    }
    const key = node.props["data-cms-section"];
    if (
      typeof node.type === "string" &&
      key &&
      presentation?.sectionMedia?.[key]?.length
    )
      children.push(
        <SectionMedia key="cms-media" items={presentation.sectionMedia[key]} />,
      );
    if (node.type === "main" && recordMedia.length)
      children.push(<SectionMedia key="record-media" items={recordMedia} />);
    if (node.type === "main" && route?.kind === "caseStudy") {
      children.push(<SharedMedia key="case-components" id="gl_components" />);
      children.push(<SharedMedia key="case-formats" id="gl_caseFormats" />);
    }
    if (typeof node.type === "string" && key === "approach")
      children.push(<SharedMedia key="process-media" id="gl_process" />);
    if (["header", "footer"].includes(node.type)) {
      const shared = snapshot.entries.global.find(
        (item) => item.id === `gl_${node.type}`,
      );
      const media = Object.values(
        shared?.presentation?.sectionMedia ?? {},
      ).flat();
      if (media.length)
        children.push(<SectionMedia key="shared-media" items={media} />);
    }
    if (node.type === "footer") {
      children.push(<SharedMedia key="social-media" id="gl_socials" />);
      const hasFaq = (child) =>
        React.isValidElement(child) &&
        (child.props.href === "/faq" ||
          React.Children.toArray(child.props.children).some(hasFaq));
      if (!children.some(hasFaq))
        children.push(
          <a key="faq-link" href="/faq" className="cms-faq-link">
            {faqLabel()}
          </a>,
        );
    }
    const result = React.cloneElement(
      node,
      props,
      ...(children.length ? children : [node.props.children]),
    );
    return typeof node.type !== "string" &&
      key &&
      presentation?.sectionMedia?.[key]?.length ? (
      <div
        key={node.key}
        data-cms-section={key}
        style={{ display: "contents" }}
      >
        {result}
        <SectionMedia items={presentation.sectionMedia[key]} />
      </div>
    ) : (
      result
    );
  }
  return visit(tree);
}
