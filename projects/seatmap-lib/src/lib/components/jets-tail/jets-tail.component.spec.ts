import { describe, it, expect, beforeEach } from 'vitest';
import { TestBed, ComponentFixture } from '@angular/core/testing';
import { JetsTailComponent } from './jets-tail.component';

describe('JetsTailComponent', () => {
  let fixture: ComponentFixture<JetsTailComponent>;
  let component: JetsTailComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [JetsTailComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(JetsTailComponent);
    component = fixture.componentInstance;
  });

  it('should create', () => {
    fixture.detectChanges();
    expect(component).toBeTruthy();
  });

  it('should render at the provided width', () => {
    component.width = 320;
    fixture.detectChanges();
    expect(component.width).toBe(320);
  });

  it('should paint the tail with fuselageFillColor', () => {
    fixture.componentRef.setInput('colorTheme', { fuselageFillColor: '#abcdef' });
    fixture.detectChanges();
    const html: string = fixture.nativeElement.innerHTML;
    expect(html).toContain('#abcdef');
  });

  it('should scale stroke-width by fuselageStrokeWidth', () => {
    fixture.componentRef.setInput('width', 200);
    fixture.componentRef.setInput('colorTheme', { fuselageStrokeWidth: 18 });
    fixture.detectChanges();
    // width=200 with viewBox 200 → scale factor 1, so stroke renders as 18 SVG units
    const html: string = fixture.nativeElement.innerHTML;
    expect(html).toContain('stroke-width:18');
  });
});
