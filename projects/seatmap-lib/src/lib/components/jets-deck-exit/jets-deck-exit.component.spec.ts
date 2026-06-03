import { describe, it, expect, beforeEach } from 'vitest';
import { TestBed, ComponentFixture } from '@angular/core/testing';
import { JetsDeckExitComponent } from './jets-deck-exit.component';

describe('JetsDeckExitComponent', () => {
  let fixture: ComponentFixture<JetsDeckExitComponent>;
  let component: JetsDeckExitComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [JetsDeckExitComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(JetsDeckExitComponent);
    component = fixture.componentInstance;
  });

  it('should create', () => {
    fixture.detectChanges();
    expect(component).toBeTruthy();
  });

  it('should accept an empty exits array', () => {
    component.exits = [];
    fixture.detectChanges();
    expect(component.exits).toEqual([]);
  });

  it('should render left and right exits', () => {
    component.exits = [
      { type: 'left', topOffset: 50 },
      { type: 'right', topOffset: 50 },
    ];
    fixture.detectChanges();
    expect(component.exits).toHaveLength(2);
  });

  it('should render custom exit icon URLs as <img> elements when colorTheme provides them', () => {
    component.exits = [
      { type: 'left', topOffset: 0 },
      { type: 'right', topOffset: 0 },
    ];
    component.colorTheme = {
      exitIconUrlLeft: 'https://example.test/left.svg',
      exitIconUrlRight: 'https://example.test/right.svg',
    } as any;
    fixture.detectChanges();

    const host: HTMLElement = fixture.nativeElement;
    const leftImg = host.querySelector(
      '.jets-exit--left img.jets-exit__icon',
    ) as HTMLImageElement | null;
    const rightImg = host.querySelector(
      '.jets-exit--right img.jets-exit__icon',
    ) as HTMLImageElement | null;

    expect(leftImg).not.toBeNull();
    expect(rightImg).not.toBeNull();
    expect(leftImg!.getAttribute('src')).toBe('https://example.test/left.svg');
    expect(rightImg!.getAttribute('src')).toBe('https://example.test/right.svg');

    // Fallback inline SVG must not render when the URL is provided.
    expect(host.querySelector('.jets-exit--left svg')).toBeNull();
    expect(host.querySelector('.jets-exit--right svg')).toBeNull();
  });

  it('should fall back to the bundled inline SVG when no icon URL is provided', () => {
    component.exits = [
      { type: 'left', topOffset: 0 },
      { type: 'right', topOffset: 0 },
    ];
    component.colorTheme = { exitColor: '#ff0000' } as any;
    fixture.detectChanges();

    const host: HTMLElement = fixture.nativeElement;
    expect(host.querySelector('.jets-exit--left img.jets-exit__icon')).toBeNull();
    expect(host.querySelector('.jets-exit--right img.jets-exit__icon')).toBeNull();
    expect(host.querySelector('.jets-exit--left svg')).not.toBeNull();
    expect(host.querySelector('.jets-exit--right svg')).not.toBeNull();
  });

  it('should ignore empty-string icon URLs and keep the bundled SVG', () => {
    component.exits = [{ type: 'left', topOffset: 0 }];
    component.colorTheme = {
      exitIconUrlLeft: '   ',
    } as any;
    fixture.detectChanges();

    const host: HTMLElement = fixture.nativeElement;
    expect(host.querySelector('.jets-exit--left img.jets-exit__icon')).toBeNull();
    expect(host.querySelector('.jets-exit--left svg')).not.toBeNull();
  });
});
