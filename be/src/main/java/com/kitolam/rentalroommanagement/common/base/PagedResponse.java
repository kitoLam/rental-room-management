package com.kitolam.rentalroommanagement.common.base;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.data.domain.Page;

import java.util.List;
import java.util.function.Function;

/**
 * Stable JSON shape for paginated results. Page numbers are 1-based for clients;
 * Spring Data's {@link Page} is 0-based, so {@link #from(Page)} converts.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class PagedResponse<T> {

    private List<T> content;

    private int number;

    private int size;

    private long totalElements;

    private int totalPages;

    private boolean hasNext;

    private boolean hasPrevious;

    private boolean isFirst;

    private boolean isLast;

    public static <T> PagedResponse<T> of(List<T> content, int pageNumber, int pageSize, long totalElements) {
        int currentPage = Math.max(pageNumber, 1);
        int totalPages = pageSize > 0 ? (int) Math.ceil((double) totalElements / pageSize) : 0;

        return PagedResponse.<T>builder()
                .content(content)
                .number(currentPage)
                .size(pageSize)
                .totalElements(totalElements)
                .totalPages(totalPages)
                .hasNext(currentPage < totalPages)
                .hasPrevious(currentPage > 1)
                .isFirst(currentPage == 1)
                .isLast(totalPages == 0 || currentPage >= totalPages)
                .build();
    }

    public static <T> PagedResponse<T> from(Page<T> page) {
        return of(page.getContent(), page.getNumber() + 1, page.getSize(), page.getTotalElements());
    }

    public static <E, T> PagedResponse<T> from(Page<E> page, Function<? super E, ? extends T> mapper) {
        List<T> content = page.getContent().stream().<T>map(mapper).toList();
        return of(content, page.getNumber() + 1, page.getSize(), page.getTotalElements());
    }
}
