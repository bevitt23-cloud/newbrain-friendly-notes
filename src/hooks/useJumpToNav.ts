import { useState, useEffect, useCallback, useRef } from "react";

export interface NavSection {
  id: string;
  title: string;
}

/**
 * Parses rendered note HTML for <section> elements with <h2> headings,
 * tracks the currently visible section via IntersectionObserver,
 * and provides a smooth-scroll helper.
 */
export function useJumpToNav(
  containerRef: React.RefObject<HTMLDivElement | null>,
  html: string,
) {
  const [sections, setSections] = useState<NavSection[]>([]);
  const [activeSectionId, setActiveSectionId] = useState<string | null>(null);
  const observerRef = useRef<IntersectionObserver | null>(null);

  // Strip emoji prefixes (any leading emoji/symbol codepoints + whitespace) and HTML tags
  const cleanTitle = (raw: string): string => {
    // Remove HTML tags first
    const noHtml = raw.replace(/<[^>]*>/g, "");
    // Strip leading emoji / symbol characters and whitespace
    // Matches common emoji ranges, variation selectors, ZWJ sequences, etc.
    return noHtml
      .replace(
        /^[\s\u{1F300}-\u{1F9FF}\u{2600}-\u{27BF}\u{FE00}-\u{FE0F}\u{200D}\u{20E3}\u{E0020}-\u{E007F}]+/u,
        "",
      )
      .trim();
  };

  // Parse sections from the rendered DOM
  useEffect(() => {
    const container = containerRef.current;
    if (!container || !html) {
      setSections([]);
      setActiveSectionId(null);
      return;
    }

    // Small delay to let React commit the dangerouslySetInnerHTML
    const parseTimer = setTimeout(() => {
      const sectionEls = container.querySelectorAll("section");
      const parsed: NavSection[] = [];

      sectionEls.forEach((section, index) => {
        const h2 = section.querySelector("h2");
        if (!h2) return;

        // Ensure the h2 has an id we can scroll to
        if (!h2.id) {
          h2.id = `section-${index}`;
        }

        const title = cleanTitle(h2.innerHTML);
        if (title) {
          parsed.push({ id: h2.id, title });
        }
      });

      setSections(parsed);

      // Default to first section
      if (parsed.length > 0) {
        setActiveSectionId(parsed[0].id);
      }
    }, 50);

    return () => clearTimeout(parseTimer);
  }, [html, containerRef]);

  // Set up IntersectionObserver to track the active section
  useEffect(() => {
    const container = containerRef.current;
    if (!container || sections.length === 0) return;

    // Clean up previous observer
    if (observerRef.current) {
      observerRef.current.disconnect();
    }

    const visibleSections = new Map<string, IntersectionObserverEntry>();

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            visibleSections.set(entry.target.id, entry);
          } else {
            visibleSections.delete(entry.target.id);
          }
        });

        // Pick the topmost visible section
        if (visibleSections.size > 0) {
          let topmost: string | null = null;
          let minTop = Infinity;

          visibleSections.forEach((entry, id) => {
            const top = entry.boundingClientRect.top;
            if (top < minTop) {
              minTop = top;
              topmost = id;
            }
          });

          if (topmost) {
            setActiveSectionId(topmost);
          }
        }
      },
      {
        // Observe within the nearest scrollable ancestor (usually the viewport)
        root: null,
        rootMargin: "-10% 0px -60% 0px",
        threshold: 0,
      },
    );

    observerRef.current = observer;

    // Observe each h2 element by its id
    sections.forEach(({ id }) => {
      const el = document.getElementById(id);
      if (el) {
        observer.observe(el);
      }
    });

    return () => {
      observer.disconnect();
      observerRef.current = null;
    };
  }, [sections, containerRef]);

  const scrollToSection = useCallback((id: string) => {
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, []);

  return { sections, activeSectionId, scrollToSection };
}
